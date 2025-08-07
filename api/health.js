module.exports = async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Notion-Supabase Sync API is running',
    timestamp: new Date().toISOString(),
    endpoints: {
      sync: '/api/sync',
      health: '/api/health'
    }
  });
}; 