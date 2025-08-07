const { createClient } = require('@supabase/supabase-js');
const logger = require('../config/logger');
const RetryManager = require('../utils/retry');
const SchemaManager = require('../utils/schemaManager');

/**
 * Supabase service for database operations
 */
class SupabaseService {
  constructor(url, anonKey) {
    this.client = createClient(url, anonKey);
    this.retryManager = new RetryManager();
  }

  /**
   * Validate Supabase connection
   * @returns {Promise<boolean>} - Whether connection is valid
   */
  async validateConnection() {
    try {
      const { data, error } = await this.retryManager.executeWithRetry(async () => {
        return await this.client.from('_dummy_table_').select('*').limit(1);
      });

      // We expect an error for non-existent table, but connection should work
      // Supabase returns different error codes for missing tables
      if (error && (error.code === '42P01' || error.code === 'PGRST205')) {
        logger.info('Supabase connection validated successfully');
        return true;
      }

      if (error) {
        logger.error('Supabase connection validation failed', { error });
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error validating Supabase connection', { error: error.message });
      return false;
    }
  }

  /**
   * Create missing columns in a table based on Notion schema
   * @param {string} tableName - Table name
   * @param {Object} databaseSchema - Notion database schema
   * @returns {Promise<Object>} - Column creation result
   */
  async createMissingColumns(tableName, databaseSchema) {
    try {
      logger.info('Creating missing columns', { tableName });

      // Extract column definitions from Notion schema
      const requiredColumns = SchemaManager.extractColumnDefinitions(databaseSchema);
      
      if (!SchemaManager.validateColumnDefinitions(requiredColumns)) {
        throw new Error('Invalid column definitions');
      }

      // Get existing columns from the table
      const existingColumns = await SchemaManager.getExistingColumns(this, tableName);
      
      // Determine which columns need to be created
      const missingColumns = SchemaManager.getMissingColumns(requiredColumns, existingColumns);
      
      if (missingColumns.length === 0) {
        logger.info('No missing columns to create', { tableName });
        return {
          success: true,
          created: 0,
          existing: existingColumns.length,
          summary: SchemaManager.createSchemaSummary(missingColumns, existingColumns)
        };
      }

      logger.info('Creating missing columns', {
        tableName,
        missingColumns: missingColumns.map(col => col.name),
        existingColumns
      });

      // Create all missing columns using ALTER TABLE statements
      const alterStatements = SchemaManager.generateAlterTableStatements(tableName, missingColumns);
      
      let createdCount = 0;
      const errors = [];

      for (const statement of alterStatements) {
        try {
          // Execute the ALTER TABLE statement
          const { error } = await this.client.rpc('exec_sql', {
            sql: statement
          });

          if (error) {
            logger.error('Failed to execute column creation statement', {
              statement,
              error: error.message
            });
            errors.push({ statement, error: error.message });
          } else {
            createdCount++;
            logger.info('Successfully created column', {
              statement,
              tableName
            });
          }
        } catch (execError) {
          logger.error('Column creation failed', {
            statement,
            error: execError.message
          });
          errors.push({ statement, error: execError.message });
        }
      }

      const result = {
        success: createdCount > 0,
        created: createdCount,
        existing: existingColumns.length,
        missing: missingColumns.length - createdCount,
        errors: errors.length > 0 ? errors : undefined,
        summary: SchemaManager.createSchemaSummary(missingColumns, existingColumns)
      };

      if (createdCount > 0) {
        logger.info('Column creation completed', result);
      } else {
        logger.warn('No columns were created', result);
      }

      return result;

    } catch (error) {
      logger.error('Error creating missing columns', {
        tableName,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Ensure table exists with basic structure
   * @param {string} tableName - Table name
   * @returns {Promise<boolean>} - Success status
   */
  async ensureTableExists(tableName) {
    try {
      const exists = await this.tableExists(tableName);
      
      if (!exists) {
        logger.info('Creating base table', { tableName });
        
        // Create table by inserting a test row
        const testRow = {
          notion_id: 'temp_table_creation',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { error } = await this.client
          .from(tableName)
          .insert(testRow);

        if (error) {
          logger.error('Error creating base table', {
            tableName,
            error: error.message
          });
          return false;
        }

        // Delete the test row
        await this.client
          .from(tableName)
          .delete()
          .eq('notion_id', 'temp_table_creation');

        logger.info('Base table created successfully', { tableName });
      } else {
        logger.info('Table already exists', { tableName });
      }
      
      return true;
    } catch (error) {
      logger.error('Error ensuring table exists', {
        tableName,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Upsert data into a table
   * @param {string} tableName - Table name
   * @param {Array<Object>} data - Data to upsert
   * @param {Object} options - Upsert options
   * @returns {Promise<Object>} - Upsert result
   */
  async upsertData(tableName, data, options = {}) {
    const {
      onConflict = 'notion_id',
      ignoreDuplicates = false
    } = options;

    try {
      if (!Array.isArray(data) || data.length === 0) {
        logger.warn('No data to upsert', { tableName });
        return { inserted: 0, updated: 0, errors: [] };
      }

      // Add updated_at timestamp to all records
      const timestampedData = data.map(record => ({
        ...record,
        updated_at: new Date().toISOString()
      }));

      const { data: result, error } = await this.retryManager.executeWithRetry(async () => {
        return await this.client
          .from(tableName)
          .upsert(timestampedData, {
            onConflict,
            ignoreDuplicates
          });
      });

      if (error) {
        logger.error('Error upserting data', { error, tableName, dataCount: data.length });
        throw error;
      }

      logger.info('Data upserted successfully', {
        tableName,
        dataCount: data.length,
        resultCount: result?.length || 0
      });

      return {
        inserted: result?.length || 0,
        updated: result?.length || 0,
        errors: []
      };
    } catch (error) {
      logger.error('Error in upsertData', {
        error: error.message,
        tableName,
        dataCount: data.length
      });
      throw error;
    }
  }

  /**
   * Insert data into a table
   * @param {string} tableName - Table name
   * @param {Array<Object>} data - Data to insert
   * @returns {Promise<Object>} - Insert result
   */
  async insertData(tableName, data) {
    try {
      if (!Array.isArray(data) || data.length === 0) {
        logger.warn('No data to insert', { tableName });
        return { inserted: 0, errors: [] };
      }

      const { data: result, error } = await this.retryManager.executeWithRetry(async () => {
        return await this.client
          .from(tableName)
          .insert(data);
      });

      if (error) {
        logger.error('Error inserting data', { error, tableName, dataCount: data.length });
        throw error;
      }

      logger.info('Data inserted successfully', {
        tableName,
        dataCount: data.length,
        resultCount: result?.length || 0
      });

      return {
        inserted: result?.length || 0,
        errors: []
      };
    } catch (error) {
      logger.error('Error in insertData', {
        error: error.message,
        tableName,
        dataCount: data.length
      });
      throw error;
    }
  }

  /**
   * Update data in a table
   * @param {string} tableName - Table name
   * @param {Object} data - Data to update
   * @param {Object} filter - Filter conditions
   * @returns {Promise<Object>} - Update result
   */
  async updateData(tableName, data, filter) {
    try {
      // Add updated_at timestamp to the data
      const timestampedData = {
        ...data,
        updated_at: new Date().toISOString()
      };

      const { data: result, error } = await this.retryManager.executeWithRetry(async () => {
        return await this.client
          .from(tableName)
          .update(timestampedData)
          .match(filter);
      });

      if (error) {
        logger.error('Error updating data', { error, tableName, filter });
        throw error;
      }

      logger.info('Data updated successfully', {
        tableName,
        resultCount: result?.length || 0
      });

      return {
        updated: result?.length || 0,
        errors: []
      };
    } catch (error) {
      logger.error('Error in updateData', {
        error: error.message,
        tableName,
        filter
      });
      throw error;
    }
  }

  /**
   * Delete data from a table
   * @param {string} tableName - Table name
   * @param {Object} filter - Filter conditions
   * @returns {Promise<Object>} - Delete result
   */
  async deleteData(tableName, filter) {
    try {
      const { data: result, error } = await this.retryManager.executeWithRetry(async () => {
        return await this.client
          .from(tableName)
          .delete()
          .match(filter);
      });

      if (error) {
        logger.error('Error deleting data', { error, tableName, filter });
        throw error;
      }

      logger.info('Data deleted successfully', {
        tableName,
        resultCount: result?.length || 0
      });

      return {
        deleted: result?.length || 0,
        errors: []
      };
    } catch (error) {
      logger.error('Error in deleteData', {
        error: error.message,
        tableName,
        filter
      });
      throw error;
    }
  }

  /**
   * Get data from a table
   * @param {string} tableName - Table name
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Query results
   */
  async getData(tableName, options = {}) {
    const {
      select = '*',
      filter = {},
      order = {},
      limit = null,
      offset = 0
    } = options;

    try {
      let query = this.client
        .from(tableName)
        .select(select);

      // Apply filters
      Object.entries(filter).forEach(([key, value]) => {
        if (typeof value === 'object' && value.operator) {
          query = query[value.operator](key, value.value);
        } else {
          query = query.eq(key, value);
        }
      });

      // Apply ordering
      Object.entries(order).forEach(([key, direction]) => {
        query = query.order(key, { ascending: direction === 'asc' });
      });

      // Apply limit and offset
      if (limit) {
        query = query.limit(limit);
      }
      if (offset > 0) {
        query = query.range(offset, offset + (limit || 1000) - 1);
      }

      const { data, error } = await this.retryManager.executeWithRetry(async () => {
        return await query;
      });

      if (error) {
        logger.error('Error getting data', { error, tableName, options });
        throw error;
      }

      logger.info('Data retrieved successfully', {
        tableName,
        resultCount: data?.length || 0
      });

      return data || [];
    } catch (error) {
      logger.error('Error in getData', {
        error: error.message,
        tableName,
        options
      });
      throw error;
    }
  }

  /**
   * Check if a table exists
   * @param {string} tableName - Table name
   * @returns {Promise<boolean>} - Whether table exists
   */
  async tableExists(tableName) {
    try {
      const { error } = await this.retryManager.executeWithRetry(async () => {
        return await this.client
          .from(tableName)
          .select('*')
          .limit(1);
      });

      return !error;
    } catch (error) {
      return false;
    }
  }
}

module.exports = SupabaseService; 