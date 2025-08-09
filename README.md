# 🔄 Notion-Supabase Sync

A production-ready Node.js application that syncs data from Notion databases to Supabase with automatic column creation, incremental sync, and a beautiful web UI.

## ✨ Features

- ✅ **Incremental Sync** - Only syncs changed pages since last sync
- ✅ **Automatic Column Creation** - Creates Supabase columns based on Notion properties
- ✅ **Data Transformation** - Converts Notion properties to Supabase format
- ✅ **Web UI Dashboard** - Beautiful interface to trigger syncs manually
- ✅ **Error Handling** - Comprehensive error management and retry logic
- ✅ **Logging** - Structured logging with file rotation
- ✅ **Serverless Ready** - Works on Vercel, Railway, or any serverless platform
- ✅ **Cron Jobs** - Automated scheduling support

## 🏗️ Architecture

```
┌─────────────────┐    HTTP Request    ┌─────────────────┐    Sync Data    ┌─────────────────┐
│   Web UI        │ ──────────────────► │   API Routes    │ ───────────────► │    Notion       │
│   (Static)      │                    │   (Serverless)  │                 │   Database      │
└─────────────────┘                    └─────────────────┘                 └─────────────────┘
                                              │
                                              ▼
                                    ┌─────────────────┐
                                    │    Supabase     │
                                    │   Database      │
                                    │                 │
                                    │ • Auto columns  │
                                    │ • Sync state    │
                                    │ • Content       │
                                    └─────────────────┘
```

## 🚀 Quick Start

### 1. Clone and Setup
```bash
git clone <your-repo>
cd notion-supabase-sync
npm install
```

### 2. Environment Variables
Create `.env` file:
```env
# Notion Configuration
NOTION_TOKEN=your_notion_integration_token
NOTION_DATABASE_ID=your_notion_database_id

# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Sync Configuration (Optional)
SYNC_BATCH_SIZE=100
MAX_RETRIES=3
RETRY_DELAY_MS=1000
```

### 3. Database Setup
Run the SQL script in your Supabase SQL Editor:
```sql
-- Run setup-database.sql in Supabase SQL Editor
```

### 4. Deploy to Vercel
```bash
npx vercel --prod
```

## 📁 Project Structure

```
notion-supabase-sync/
├── api/                    # Serverless API routes
│   ├── sync.js            # Main sync endpoint
│   └── health.js          # Health check endpoint
├── config/                 # Configuration files
│   └── logger.js          # Winston logging setup
├── services/              # Business logic
│   ├── notionService.js   # Notion API interactions
│   └── supabaseService.js # Supabase operations
├── utils/                 # Utility functions
│   ├── dataTransformer.js # Data transformation logic
│   └── schemaManager.js   # Schema management
├── public/               # Static files
│   └── index.html        # Web UI dashboard
├── index.js              # Main sync script
├── setup-database.sql    # Database setup
├── vercel.json           # Vercel configuration
└── package.json          # Dependencies
```

## 🎯 Usage

### Web UI
Visit your deployed URL to access the dashboard:
- **Incremental Sync**: Syncs only changed pages
- **Full Sync**: Syncs all pages
- **Max Pages**: Limit the number of pages to sync

### API Endpoints

#### Sync Data
```bash
POST /api/sync
```

**Query Parameters:**
- `forceFullSync=true` - Force full sync
- `maxPages=50` - Limit pages to sync
- `dryRun=true` - Test without saving

**Response:**
```json
{
  "success": true,
  "message": "Sync completed successfully",
  "result": {
    "stats": {
      "totalFetched": 78,
      "totalTransformed": 78,
      "totalSynced": 78
    },
    "message": "Sync completed successfully"
  }
}
```

#### Health Check
```bash
GET /api/health
```

**Response:**
```json
{
  "success": true,
  "message": "Notion-Supabase Sync API is running",
  "environment": "Vercel",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "endpoints": {
    "sync": "/api/sync",
    "health": "/api/health"
  },
  "features": {
    "incrementalSync": true,
    "fullSync": true,
    "automaticColumnCreation": true,
    "cronScheduling": true
  }
}
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NOTION_TOKEN` | Notion integration token | ✅ |
| `NOTION_DATABASE_ID` | Notion database ID | ✅ |
| `SUPABASE_URL` | Supabase project URL | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | ✅ |
| `SUPABASE_ANON_KEY` | Supabase anon key | ✅ |
| `SYNC_BATCH_SIZE` | Pages per batch (default: 100) | ❌ |
| `MAX_RETRIES` | Max retry attempts (default: 3) | ❌ |
| `RETRY_DELAY_MS` | Retry delay in ms (default: 1000) | ❌ |

### Database Schema

The sync creates these tables:

#### `wheeltribe_content`
- `id` - Primary key
- `notion_id` - Unique Notion page ID
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp
- `last_edited_time` - Notion last edited time
- Dynamic columns based on Notion properties

#### `sync_state`
- `id` - Primary key
- `last_sync_time` - Last successful sync time
- `sync_type` - Type of last sync
- `pages_processed` - Number of pages processed

## 🔄 Scheduling

### GitHub Actions (Recommended)

The repository includes a complete GitHub Actions workflow for automated scheduling:

#### Setup:
1. **Automatic Schedule**: Runs every 30 minutes

2. **Manual Triggering**: Go to Actions tab → "Scheduled Notion to Supabase Sync" → "Run workflow"
   - ✅ Force full sync option
   - ✅ Dry run mode option  
   - ✅ Limit max pages option

4. **Monitoring**: Full logs and status tracking in GitHub Actions

#### Workflow file: `.github/workflows/scheduled-sync.yml`
```yaml
name: Scheduled Notion to Supabase Sync
on:
  schedule:
    - cron: '30 13 * * *'  # 7 PM IST daily
  workflow_dispatch:      # Manual triggering
```

### Alternative: Vercel Cron Jobs
```json
{
  "crons": [
    {
      "path": "/api/sync", 
      "schedule": "30 13 * * *"
    }
  ]
}
```
*Note: Vercel cron requires paid plan for reliable scheduling*

## 🛠️ Development

### Local Development
```bash
# Install dependencies
npm install

# Run sync locally
npm run dev

# Run tests
npm test
```

### Testing
```bash
# Test sync with dry run
curl -X POST "http://localhost:3000/api/sync?dryRun=true"

# Check health
curl -X GET "http://localhost:3000/api/health"
```

## 🔍 Monitoring

### Logs
- **Console**: Real-time logs during sync
- **Files**: Daily rotated log files in `logs/` directory
- **Vercel**: Function logs in Vercel dashboard

### Database Monitoring
```sql
-- Check sync state
SELECT * FROM sync_state ORDER BY last_sync_time DESC LIMIT 1;

-- Check recent content
SELECT * FROM wheeltribe_content ORDER BY updated_at DESC LIMIT 10;
```

## 🚨 Troubleshooting

### Common Issues

1. **"Could not find column" error**
   - Run the database setup script
   - Check if automatic column creation is working

2. **"Notion API error"**
   - Verify `NOTION_TOKEN` is correct
   - Check if integration has access to database

3. **"Supabase connection error"**
   - Verify `SUPABASE_URL` and keys
   - Check if service role key has proper permissions

4. **"CORS error"**
   - API endpoints include CORS headers
   - Check if calling from allowed origins

### Debug Mode
```bash
# Enable debug logging
LOG_LEVEL=debug npm run dev
```

## 📊 Performance

- **Incremental Sync**: ~1-5 seconds for small changes
- **Full Sync**: Depends on database size
- **Memory Usage**: ~50-100MB during sync
- **API Response**: < 2 seconds for most requests

## 🔒 Security

- ✅ **Environment Variables** - Sensitive data stored securely
- ✅ **Service Role Key** - Minimal required permissions
- ✅ **CORS Headers** - Proper cross-origin handling
- ✅ **Error Sanitization** - No sensitive data in error messages

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

---

**Made with ❤️ for seamless Notion-Supabase integration** 