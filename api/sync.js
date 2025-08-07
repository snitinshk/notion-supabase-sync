const NotionSupabaseSync = require('../index.js');

module.exports = async (req, res) => {
  try {
    console.log('Vercel API route triggered');
    
    // Parse query parameters
    const { forceFullSync, maxPages, dryRun } = req.query;
    
    // Create sync instance
    const sync = new NotionSupabaseSync();
    
    // Initialize
    await sync.initialize();
    
    // Run sync with options
    const options = {
      forceFullSync: forceFullSync === 'true',
      dryRun: dryRun === 'true',
      maxPages: maxPages ? parseInt(maxPages) : null
    };
    
    console.log('Sync options:', options);
    
    // Execute sync
    const result = await sync.sync(options);
    
    console.log('Sync completed:', result);
    
    res.status(200).json({
      success: true,
      message: 'Sync completed successfully',
      result: result
    });
    
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}; 