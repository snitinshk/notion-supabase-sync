const logger = require('../config/logger');

/**
 * Schema manager for handling Notion to Supabase schema mapping
 */
class SchemaManager {
  /**
   * Map Notion property types to Supabase column types
   * @param {string} notionType - Notion property type
   * @returns {string} - Supabase column type
   */
  static mapNotionTypeToSupabaseType(notionType) {
    switch (notionType) {
      case 'title':
      case 'rich_text':
      case 'select':
      case 'url':
      case 'email':
      case 'phone_number':
      case 'created_by':
      case 'last_edited_by':
      case 'status':
        return 'TEXT';
      
      case 'multi_select':
      case 'people':
      case 'relation':
      case 'files':
        return 'TEXT[]';
      
      case 'date':
      case 'created_time':
      case 'last_edited_time':
        return 'TIMESTAMP WITH TIME ZONE';
      
      case 'checkbox':
        return 'BOOLEAN';
      
      case 'number':
        return 'NUMERIC';
      
      case 'formula':
        return 'TEXT'; // Default to TEXT for formulas
      
      case 'rollup':
        return 'TEXT'; // Default to TEXT for rollups
      
      default:
        logger.warn(`Unknown Notion type: ${notionType}, defaulting to TEXT`);
        return 'TEXT';
    }
  }

  /**
   * Convert property name to snake_case for database compatibility
   * @param {string} propertyName - Notion property name
   * @returns {string} - Database column name
   */
  static convertToSnakeCase(propertyName) {
    return propertyName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  /**
   * Extract column definitions from Notion database schema
   * @param {Object} databaseSchema - Notion database schema
   * @returns {Array} - Array of column definitions
   */
  static extractColumnDefinitions(databaseSchema) {
    const columns = [];
    
    if (!databaseSchema || !databaseSchema.properties) {
      logger.warn('Invalid database schema provided');
      return columns;
    }

    for (const [propertyName, propertyConfig] of Object.entries(databaseSchema.properties)) {
      try {
        const columnName = this.convertToSnakeCase(propertyName);
        const columnType = this.mapNotionTypeToSupabaseType(propertyConfig.type);
        
        columns.push({
          name: columnName,
          type: columnType,
          originalName: propertyName,
          notionType: propertyConfig.type
        });
        
        logger.debug('Column definition created', {
          originalName: propertyName,
          columnName,
          columnType,
          notionType: propertyConfig.type
        });
      } catch (error) {
        logger.error('Error creating column definition', {
          propertyName,
          error: error.message
        });
      }
    }

    return columns;
  }

  /**
   * Generate ALTER TABLE statements for missing columns
   * @param {string} tableName - Target table name
   * @param {Array} columnDefinitions - Column definitions
   * @returns {Array} - Array of SQL statements
   */
  static generateAlterTableStatements(tableName, columnDefinitions) {
    return columnDefinitions.map(column => {
      return `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${column.name} ${column.type}`;
    });
  }

  /**
   * Get existing columns from Supabase table using a different approach
   * @param {Object} supabaseService - Supabase service instance
   * @param {string} tableName - Table name
   * @returns {Promise<Array>} - Array of existing column names
   */
  static async getExistingColumns(supabaseService, tableName) {
    try {
      // Try to get a single row to check if table exists and get column info
      const { data, error } = await supabaseService.client
        .from(tableName)
        .select('*')
        .limit(1);

      if (error) {
        if (error.code === '42P01') {
          // Table doesn't exist
          logger.info('Table does not exist yet', { tableName });
          return [];
        }
        throw error;
      }

      // If we get data, the table exists but we need to get column names differently
      // Since we can't use information_schema directly, we'll use a workaround
      // by trying to insert a test row and see what columns are available
      
      // Get the first row to see what columns exist
      const { data: sampleData } = await supabaseService.client
        .from(tableName)
        .select('*')
        .limit(1);

      if (sampleData && sampleData.length > 0) {
        // Extract column names from the first row
        const existingColumns = Object.keys(sampleData[0]);
        logger.info('Found existing columns', { tableName, columns: existingColumns });
        return existingColumns;
      }

      // If no data exists, we'll assume only the base columns exist
      logger.info('No data in table, assuming base columns only', { tableName });
      return ['id', 'notion_id', 'created_at', 'updated_at'];

    } catch (error) {
      logger.error('Error getting existing columns', {
        tableName,
        error: error.message
      });
      
      // Fallback: return base columns
      return ['id', 'notion_id', 'created_at', 'updated_at'];
    }
  }

  /**
   * Determine which columns need to be created
   * @param {Array} requiredColumns - Required column definitions
   * @param {Array} existingColumns - Existing column names
   * @returns {Array} - Columns that need to be created
   */
  static getMissingColumns(requiredColumns, existingColumns) {
    return requiredColumns.filter(column => 
      !existingColumns.includes(column.name)
    );
  }

  /**
   * Handle schema cache errors by attempting to refresh the cache
   * @param {Object} supabaseService - Supabase service instance
   * @param {string} tableName - Table name
   * @param {Error} error - The original error
   * @returns {Promise<boolean>} - Whether the error was handled successfully
   */
  static async handleSchemaCacheError(supabaseService, tableName, error) {
    // Check if this is a schema cache error
    if (error.code === 'PGRST204' && error.message.includes('schema cache')) {
      logger.warn('Schema cache error detected, attempting recovery', { 
        tableName, 
        error: error.message 
      });
      
      try {
        // Attempt to refresh the schema cache
        await supabaseService.refreshSchemaCache(tableName);
        
        // Wait a moment for the cache to refresh
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        logger.info('Schema cache error recovery completed', { tableName });
        return true;
      } catch (refreshError) {
        logger.error('Failed to recover from schema cache error', { 
          tableName, 
          originalError: error.message,
          refreshError: refreshError.message 
        });
        return false;
      }
    }
    
    return false;
  }

  /**
   * Validate column definitions
   * @param {Array} columnDefinitions - Column definitions to validate
   * @returns {boolean} - Whether all definitions are valid
   */
  static validateColumnDefinitions(columnDefinitions) {
    if (!Array.isArray(columnDefinitions)) {
      logger.error('Column definitions must be an array');
      return false;
    }

    for (const column of columnDefinitions) {
      if (!column.name || !column.type) {
        logger.error('Invalid column definition', { column });
        return false;
      }

      // Check for reserved SQL keywords
      const reservedKeywords = ['order', 'group', 'select', 'where', 'from', 'table'];
      if (reservedKeywords.includes(column.name.toLowerCase())) {
        logger.warn(`Column name '${column.name}' might conflict with SQL keywords`);
      }
    }

    return true;
  }

  /**
   * Create a summary of schema changes
   * @param {Array} missingColumns - Columns that will be created
   * @param {Array} existingColumns - Existing columns
   * @returns {Object} - Schema change summary
   */
  static createSchemaSummary(missingColumns, existingColumns) {
    return {
      totalColumns: existingColumns.length + missingColumns.length,
      existingColumns: existingColumns.length,
      newColumns: missingColumns.length,
      columnsToCreate: missingColumns.map(col => ({
        name: col.name,
        type: col.type,
        originalName: col.originalName
      }))
    };
  }
}

module.exports = SchemaManager; 