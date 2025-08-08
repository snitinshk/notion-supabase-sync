const express = require('express');
const path = require('path');
const NotionSupabaseSync = require('./index.js');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from public directory
app.use(express.static('public'));
app.use(express.json());

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Notion-Supabase Sync API is running',
      environment: 'Local',
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
});

// Sync endpoint
app.post('/api/sync', async (req, res) => {
  try {
    console.log('Local sync request received:', req.query);
    
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
    
    res.json({
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
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Local server running on http://localhost:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🔧 API: http://localhost:${PORT}/api/sync`);
  console.log(`💚 Health: http://localhost:${PORT}/api/health`);
});
