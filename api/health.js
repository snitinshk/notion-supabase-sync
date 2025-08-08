module.exports = async (req, res) => {
  try {
    // Basic health check
    res.status(200).json({
      success: true,
      message: 'Notion-Supabase Sync API is running',
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