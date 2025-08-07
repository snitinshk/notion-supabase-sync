const logger = require('../config/logger');

/**
 * Sync state management for tracking incremental sync progress
 */
class SyncStateManager {
  constructor(supabase, tableName = 'sync_state') {
    this.supabase = supabase;
    this.tableName = tableName;
  }

  /**
   * Get the last sync timestamp for a database
   * @param {string} databaseId - Notion database ID
   * @returns {Promise<string|null>} - Last sync timestamp or null
   */
  async getLastSyncTime(databaseId) {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('last_sync_time')
        .eq('database_id', databaseId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        logger.error('Error fetching last sync time', { error, databaseId });
        return null;
      }

      return data?.last_sync_time || null;
    } catch (error) {
      logger.error('Error in getLastSyncTime', { error: error.message, databaseId });
      return null;
    }
  }

  /**
   * Update the last sync timestamp for a database
   * @param {string} databaseId - Notion database ID
   * @param {string} syncTime - ISO timestamp string
   * @returns {Promise<boolean>} - Success status
   */
  async updateLastSyncTime(databaseId, syncTime) {
    try {
      const { error } = await this.supabase
        .from(this.tableName)
        .upsert({
          database_id: databaseId,
          last_sync_time: syncTime,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'database_id'
        });

      if (error) {
        logger.error('Error updating last sync time', { error, databaseId, syncTime });
        return false;
      }

      logger.info('Sync state updated', { databaseId, syncTime });
      return true;
    } catch (error) {
      logger.error('Error in updateLastSyncTime', { error: error.message, databaseId, syncTime });
      return false;
    }
  }

  /**
   * Initialize sync state table if it doesn't exist
   * @returns {Promise<boolean>} - Success status
   */
  async initializeSyncStateTable() {
    try {
      // Check if table exists by trying to select from it
      const { error } = await this.supabase
        .from(this.tableName)
        .select('database_id')
        .limit(1);

      if (error && error.code === '42P01') { // Table doesn't exist
        logger.info('Sync state table does not exist, creating...');
        
        // Create the table using SQL
        const { error: createError } = await this.supabase.rpc('create_sync_state_table', {
          table_name: this.tableName
        });

        if (createError) {
          logger.error('Error creating sync state table', { error: createError });
          return false;
        }

        logger.info('Sync state table created successfully');
      }

      return true;
    } catch (error) {
      logger.error('Error initializing sync state table', { error: error.message });
      return false;
    }
  }

  /**
   * Get sync statistics for a database
   * @param {string} databaseId - Notion database ID
   * @returns {Promise<Object>} - Sync statistics
   */
  async getSyncStats(databaseId) {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('database_id', databaseId)
        .single();

      if (error && error.code !== 'PGRST116') {
        logger.error('Error fetching sync stats', { error, databaseId });
        return null;
      }

      return data || {
        database_id: databaseId,
        last_sync_time: null,
        created_at: null,
        updated_at: null
      };
    } catch (error) {
      logger.error('Error in getSyncStats', { error: error.message, databaseId });
      return null;
    }
  }

  /**
   * Clean up old sync state records
   * @param {number} daysToKeep - Number of days to keep records
   * @returns {Promise<boolean>} - Success status
   */
  async cleanupOldRecords(daysToKeep = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const { error } = await this.supabase
        .from(this.tableName)
        .delete()
        .lt('updated_at', cutoffDate.toISOString());

      if (error) {
        logger.error('Error cleaning up old sync records', { error });
        return false;
      }

      logger.info('Old sync records cleaned up', { cutoffDate: cutoffDate.toISOString() });
      return true;
    } catch (error) {
      logger.error('Error in cleanupOldRecords', { error: error.message });
      return false;
    }
  }
}

module.exports = SyncStateManager; 