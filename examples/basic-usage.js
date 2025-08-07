const NotionSupabaseSync = require('../index');

/**
 * Basic usage example
 */
async function basicSync() {
  try {
    // Initialize the sync with configuration
    const sync = new NotionSupabaseSync({
      notionToken: process.env.NOTION_TOKEN,
      notionDatabaseId: process.env.NOTION_DATABASE_ID,
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
      tableName: 'my_notion_pages', // Custom table name
      batchSize: 50, // Smaller batch size for testing
      maxRetries: 5,
      retryDelay: 2000
    });

    // Initialize connections
    await sync.initialize();

    // Run incremental sync
    const result = await sync.sync({
      forceFullSync: false,
      dryRun: false,
      maxPages: 100 // Limit for testing
    });

    console.log('Sync completed successfully!');
    console.log('Result:', JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('Sync failed:', error.message);
    process.exit(1);
  }
}

/**
 * Example with custom data transformation
 */
async function customSync() {
  try {
    const sync = new NotionSupabaseSync();

    await sync.initialize();

    // Get sync statistics
    const stats = await sync.getSyncStats();
    console.log('Current sync stats:', stats);

    // Run sync with custom options
    const result = await sync.sync({
      forceFullSync: true, // Force full sync
      dryRun: true, // Test run without making changes
      maxPages: 10 // Limit for testing
    });

    console.log('Dry run completed:', result);

  } catch (error) {
    console.error('Custom sync failed:', error.message);
  }
}

/**
 * Example with error handling and monitoring
 */
async function monitoredSync() {
  const sync = new NotionSupabaseSync();
  
  try {
    console.log('Starting monitored sync...');
    
    await sync.initialize();
    
    const startTime = Date.now();
    const result = await sync.sync();
    const duration = Date.now() - startTime;
    
    console.log(`Sync completed in ${duration}ms`);
    console.log(`Processed ${result.stats.totalSynced} pages`);
    console.log(`Success rate: ${result.stats.syncRate}%`);
    
    // Clean up old records
    await sync.cleanup(30); // Keep last 30 days
    
  } catch (error) {
    console.error('Monitored sync failed:', error.message);
    
    // Get current stats even if sync failed
    try {
      const stats = await sync.getSyncStats();
      console.log('Current stats:', stats);
    } catch (statsError) {
      console.error('Could not get stats:', statsError.message);
    }
  }
}

/**
 * Example with multiple databases
 */
async function multiDatabaseSync() {
  const databases = [
    {
      id: process.env.NOTION_DATABASE_ID_1,
      table: 'database_1_pages'
    },
    {
      id: process.env.NOTION_DATABASE_ID_2,
      table: 'database_2_pages'
    }
  ];

  for (const db of databases) {
    try {
      console.log(`Syncing database: ${db.id}`);
      
      const sync = new NotionSupabaseSync({
        notionDatabaseId: db.id,
        tableName: db.table
      });

      await sync.initialize();
      const result = await sync.sync();
      
      console.log(`Database ${db.id} synced:`, result.stats);
      
    } catch (error) {
      console.error(`Failed to sync database ${db.id}:`, error.message);
    }
  }
}

// Run examples
if (require.main === module) {
  const example = process.argv[2] || 'basic';
  
  switch (example) {
    case 'basic':
      basicSync();
      break;
    case 'custom':
      customSync();
      break;
    case 'monitored':
      monitoredSync();
      break;
    case 'multi':
      multiDatabaseSync();
      break;
    default:
      console.log('Available examples: basic, custom, monitored, multi');
      console.log('Usage: node basic-usage.js [example]');
  }
}

module.exports = {
  basicSync,
  customSync,
  monitoredSync,
  multiDatabaseSync
}; 