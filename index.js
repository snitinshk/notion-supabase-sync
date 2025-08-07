#!/usr/bin/env node

require('dotenv').config();
const logger = require('./config/logger');
const NotionService = require('./services/notionService');
const SupabaseService = require('./services/supabaseService');
const SyncStateManager = require('./utils/syncState');
const { transformNotionPage, validateTransformedData } = require('./utils/dataTransformer');
const RetryManager = require('./utils/retry');

/**
 * Main Notion to Supabase sync orchestrator
 */
class NotionSupabaseSync {
  constructor(config = {}) {
    this.config = {
      notionToken: config.notionToken || process.env.NOTION_TOKEN,
      notionDatabaseId: config.notionDatabaseId || process.env.NOTION_DATABASE_ID,
      supabaseUrl: config.supabaseUrl || process.env.SUPABASE_URL,
      supabaseServiceRoleKey: config.supabaseServiceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY,
      tableName: config.tableName || 'notion_pages',
      batchSize: parseInt(config.batchSize || process.env.SYNC_BATCH_SIZE || '100'),
      maxRetries: parseInt(config.maxRetries || process.env.MAX_RETRIES || '3'),
      retryDelay: parseInt(config.retryDelay || process.env.RETRY_DELAY_MS || '1000'),
      ...config
    };

    this.validateConfig();
    
    this.notionService = new NotionService(this.config.notionToken);
    this.supabaseService = new SupabaseService(this.config.supabaseUrl, this.config.supabaseServiceRoleKey);
    this.syncStateManager = new SyncStateManager(this.supabaseService.client);
    this.retryManager = new RetryManager(this.config.maxRetries, this.config.retryDelay);
  }

  /**
   * Validate configuration
   */
  validateConfig() {
    const required = [
      'notionToken',
      'notionDatabaseId', 
      'supabaseUrl',
      'supabaseServiceRoleKey'
    ];

    const missing = required.filter(key => !this.config[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required configuration: ${missing.join(', ')}`);
    }

    logger.info('Configuration validated successfully');
  }

  /**
   * Initialize sync process
   */
  async initialize() {
    logger.info('Initializing Notion to Supabase sync', {
      databaseId: this.config.notionDatabaseId,
      tableName: this.config.tableName
    });

    try {
      // Validate connections
      const [notionValid, supabaseValid] = await Promise.all([
        this.notionService.validateToken(),
        this.supabaseService.validateConnection()
      ]);

      if (!notionValid) {
        throw new Error('Invalid Notion token');
      }

      if (!supabaseValid) {
        throw new Error('Invalid Supabase connection');
      }

      // Ensure base table exists
      await this.supabaseService.ensureTableExists(this.config.tableName);

      // Initialize sync state table
      await this.syncStateManager.initializeSyncStateTable();

      logger.info('Sync initialization completed successfully');
      return true;
    } catch (error) {
      logger.error('Sync initialization failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Main sync function with incremental logic
   */
  async sync(options = {}) {
    const {
      forceFullSync = false,
      dryRun = false,
      maxPages = null
    } = options;

    const startTime = new Date();
    logger.info('Starting sync process', {
      databaseId: this.config.notionDatabaseId,
      tableName: this.config.tableName,
      forceFullSync,
      dryRun,
      maxPages
    });

    try {
      // Get Notion database schema and ensure columns exist
      const databaseSchema = await this.notionService.getDatabaseSchema(this.config.notionDatabaseId);
      
      if (!dryRun) {
        // Create missing columns based on Notion schema
        const columnResult = await this.supabaseService.createMissingColumns(
          this.config.tableName, 
          databaseSchema
        );
        
        logger.info('Schema synchronization completed', {
          tableName: this.config.tableName,
          created: columnResult.created,
          existing: columnResult.existing,
          missing: columnResult.missing,
          errors: columnResult.errors,
          summary: columnResult.summary
        });
      }

      // Get last sync time for incremental sync
      let lastSyncTime = null;
      if (!forceFullSync) {
        lastSyncTime = await this.syncStateManager.getLastSyncTime(this.config.notionDatabaseId);
        if (lastSyncTime) {
          logger.info('Incremental sync detected', { lastSyncTime });
        } else {
          logger.info('Full sync required - no previous sync found');
        }
      }

      // Fetch pages from Notion
      const notionPages = await this.fetchNotionPages(lastSyncTime, maxPages);
      
      if (notionPages.length === 0) {
        logger.info('No pages to sync');
        return this.createSyncResult(startTime, 0, 0, 0);
      }

      // Transform pages
      const transformedPages = await this.transformPages(notionPages);
      
      if (transformedPages.length === 0) {
        logger.warn('No valid pages after transformation');
        return this.createSyncResult(startTime, notionPages.length, 0, 0);
      }

      // Sync to Supabase
      let syncResult;
      if (dryRun) {
        logger.info('Dry run mode - skipping database operations', {
          pagesToSync: transformedPages.length
        });
        syncResult = { inserted: 0, updated: transformedPages.length, errors: [] };
      } else {
        syncResult = await this.syncToSupabase(transformedPages);
      }

      // Update sync state
      if (!dryRun) {
        await this.syncStateManager.updateLastSyncTime(
          this.config.notionDatabaseId,
          startTime.toISOString()
        );
      }

      const finalResult = this.createSyncResult(
        startTime,
        notionPages.length,
        transformedPages.length,
        syncResult.inserted + syncResult.updated
      );

      logger.info('Sync completed successfully', finalResult);
      return finalResult;

    } catch (error) {
      logger.error('Sync failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Fetch pages from Notion with incremental logic
   */
  async fetchNotionPages(lastSyncTime, maxPages) {
    try {
      const options = {
        pageSize: this.config.batchSize,
        lastSyncTime: lastSyncTime
      };

      logger.info('Fetching pages from Notion', {
        databaseId: this.config.notionDatabaseId,
        lastSyncTime,
        maxPages
      });

      const pages = await this.notionService.getAllDatabasePages(
        this.config.notionDatabaseId,
        options
      );

      // Apply max pages limit if specified
      const limitedPages = maxPages ? pages.slice(0, maxPages) : pages;

      logger.info('Pages fetched from Notion', {
        total: pages.length,
        limited: limitedPages.length,
        maxPages
      });

      return limitedPages;
    } catch (error) {
      logger.error('Error fetching Notion pages', { error: error.message });
      throw error;
    }
  }

  /**
   * Transform Notion pages to Supabase format
   */
  async transformPages(notionPages) {
    logger.info('Transforming pages', { count: notionPages.length });

    const transformedPages = [];
    const errors = [];

    for (const page of notionPages) {
      try {
        const transformedPage = transformNotionPage(page);
        
        if (validateTransformedData(transformedPage)) {
          transformedPages.push(transformedPage);
        } else {
          errors.push({
            pageId: page.id,
            error: 'Invalid transformed data'
          });
        }
      } catch (error) {
        errors.push({
          pageId: page.id,
          error: error.message
        });
        logger.error('Error transforming page', {
          pageId: page.id,
          error: error.message
        });
      }
    }

    if (errors.length > 0) {
      logger.warn('Page transformation errors', {
        total: notionPages.length,
        successful: transformedPages.length,
        errors: errors.length,
        errorDetails: errors.slice(0, 5) // Log first 5 errors
      });
    }

    logger.info('Page transformation completed', {
      total: notionPages.length,
      successful: transformedPages.length,
      errors: errors.length
    });

    return transformedPages;
  }

  /**
   * Sync transformed pages to Supabase
   */
  async syncToSupabase(transformedPages) {
    logger.info('Syncing pages to Supabase', {
      tableName: this.config.tableName,
      pageCount: transformedPages.length
    });

    try {
      const result = await this.supabaseService.upsertData(
        this.config.tableName,
        transformedPages,
        {
          onConflict: 'notion_id'
        }
      );

      logger.info('Supabase sync completed', {
        tableName: this.config.tableName,
        inserted: result.inserted,
        updated: result.updated,
        errors: result.errors.length
      });

      return result;
    } catch (error) {
      logger.error('Error syncing to Supabase', {
        error: error.message,
        tableName: this.config.tableName,
        pageCount: transformedPages.length
      });
      throw error;
    }
  }

  /**
   * Create sync result object
   */
  createSyncResult(startTime, totalFetched, totalTransformed, totalSynced) {
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    return {
      success: true,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration: duration,
      durationSeconds: Math.round(duration / 1000),
      stats: {
        totalFetched,
        totalTransformed,
        totalSynced,
        transformationRate: totalFetched > 0 ? (totalTransformed / totalFetched * 100).toFixed(2) : 0,
        syncRate: totalTransformed > 0 ? (totalSynced / totalTransformed * 100).toFixed(2) : 0
      },
      config: {
        databaseId: this.config.notionDatabaseId,
        tableName: this.config.tableName,
        batchSize: this.config.batchSize
      }
    };
  }

  /**
   * Get sync statistics
   */
  async getSyncStats() {
    try {
      const stats = await this.syncStateManager.getSyncStats(this.config.notionDatabaseId);
      
      // Get table row count
      const tableData = await this.supabaseService.getData(this.config.tableName, {
        select: 'count',
        limit: 1
      });

      return {
        ...stats,
        tableRowCount: tableData.length > 0 ? tableData[0].count : 0
      };
    } catch (error) {
      logger.error('Error getting sync stats', { error: error.message });
      return null;
    }
  }

  /**
   * Clean up old sync records
   */
  async cleanup(daysToKeep = 30) {
    try {
      const result = await this.syncStateManager.cleanupOldRecords(daysToKeep);
      logger.info('Cleanup completed', { daysToKeep, success: result });
      return result;
    } catch (error) {
      logger.error('Error during cleanup', { error: error.message });
      return false;
    }
  }
}

/**
 * Main execution function
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'sync';

  try {
    const sync = new NotionSupabaseSync();
    
    switch (command) {
      case 'sync':
        await sync.initialize();
        const result = await sync.sync({
          forceFullSync: args.includes('--full'),
          dryRun: args.includes('--dry-run'),
          maxPages: args.find(arg => arg.startsWith('--max-pages='))?.split('=')[1]
        });
        console.log('Sync completed:', JSON.stringify(result, null, 2));
        break;

      case 'stats':
        await sync.initialize();
        const stats = await sync.getSyncStats();
        console.log('Sync stats:', JSON.stringify(stats, null, 2));
        break;

      case 'cleanup':
        await sync.initialize();
        const days = args.find(arg => arg.startsWith('--days='))?.split('=')[1] || 30;
        const cleanupResult = await sync.cleanup(parseInt(days));
        console.log('Cleanup completed:', cleanupResult);
        break;

      default:
        console.log('Usage: node index.js [sync|stats|cleanup] [options]');
        console.log('Options:');
        console.log('  --full        Force full sync');
        console.log('  --dry-run     Run without making changes');
        console.log('  --max-pages=N Limit number of pages to sync');
        console.log('  --days=N      Days to keep for cleanup (default: 30)');
        break;
    }
  } catch (error) {
    logger.error('Application error', { error: error.message });
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = NotionSupabaseSync; 