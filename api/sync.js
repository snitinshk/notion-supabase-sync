const NotionSupabaseSync = require('../index.js');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed. Use POST.' 
    });
  }

  try {
    // Log the request source for debugging
    const userAgent = req.headers['user-agent'] || '';
    const isFromSupabase = userAgent.includes('Supabase') || req.headers['x-supabase-function'] === 'true';
    
    console.log('Sync API triggered', {
      source: isFromSupabase ? 'Supabase Edge Function' : 'Direct',
      environment: process.env.VERCEL ? 'Vercel' : 'Local',
      userAgent: userAgent.substring(0, 100),
      method: req.method,
      url: req.url
    });
    
    // Parse query parameters
    const { forceFullSync, maxPages, dryRun } = req.query;
    
    // Create sync instance
    const sync = new NotionSupabaseSync();
    
    // Initialize
    await sync.initialize();
    
    // Run sync with options - cron jobs will use incremental sync by default
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