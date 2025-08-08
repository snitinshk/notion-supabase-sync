// Unified handler that works both locally and on Vercel
const healthHandler = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed. Use GET.' 
    });
  }

  try {
    res.json({
      success: true,
      message: 'Notion-Supabase Sync API is running',
      environment: process.env.VERCEL ? 'Vercel' : 'Local',
      timestamp: new Date().toISOString(),
      endpoints: {
        sync: '/api/sync',
        health: '/api/health'
      },
      features: {
        incrementalSync: true,
        fullSync: true,
        automaticColumnCreation: true,
        cronScheduling: true
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Export for Vercel (serverless)
module.exports = healthHandler;

// Export for local Express server
module.exports.handler = healthHandler; 