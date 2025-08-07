# Notion to Supabase Sync

A production-ready Node.js script that syncs data from Notion databases to Supabase with **automatic column creation**, incremental sync support, comprehensive error handling, and robust logging.

## Features

- 🔄 **Incremental Sync**: Only syncs records modified since last sync
- 🏗️ **Automatic Column Creation**: Creates Supabase columns based on Notion schema
- 🛡️ **Error Handling**: Comprehensive error handling with retry mechanisms
- 📊 **Logging**: Structured logging with Winston and daily rotation
- 🔧 **Data Transformation**: Handles all common Notion property types
- ⚡ **Upsert Operations**: Handles both new and updated records
- 🚀 **Production Ready**: Includes retry logic, rate limiting, and monitoring
- 🔄 **Reusable**: Works with any Notion database

## Supported Notion Property Types

- ✅ Title
- ✅ Rich Text
- ✅ Select
- ✅ Multi-select
- ✅ Date
- ✅ Checkbox
- ✅ Number
- ✅ URL
- ✅ Email
- ✅ Phone Number
- ✅ Files
- ✅ People
- ✅ Relation
- ✅ Formula
- ✅ Rollup
- ✅ Created Time/By
- ✅ Last Edited Time/By

## Prerequisites

- Node.js 18+ 
- Notion API token
- Supabase project with database access
- Notion database ID

## Installation

1. Clone or download the project
2. Install dependencies:

```bash
npm install
```

3. Copy the environment example file:

```bash
cp env.example .env
```

## Environment Variables

Create a `.env` file in the project root with the following variables:

```bash
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

**Important:** The sync script uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS policies and perform database operations. Your application should use `SUPABASE_ANON_KEY` for normal operations.

## Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp env.example .env
# Edit .env with your credentials
```

### 3. Setup Database
```sql
-- Run this in your Supabase SQL Editor
-- This creates tables, indexes, and enables automatic column creation
```

Open `setup-database.sql` in your Supabase SQL Editor and run it.

### 4. Run the Sync
```bash
node index.js sync
```

### 3. Automatic Schema Management

The script automatically:
- ✅ Creates the base table if it doesn't exist
- ✅ Detects your Notion database schema
- ✅ **Creates ALL missing columns automatically** using ALTER TABLE statements
- ✅ Handles schema changes when you add new properties
- ✅ Falls back to test insertion if ALTER TABLE fails

**You only need to run the sync - everything else is automatic!**

**Note:** The `setup-database.sql` script creates an `exec_sql` function that enables automatic column creation. Run it once in your Supabase SQL Editor.

**Schema:** The base table contains only essential fields (`id`, `notion_id`, `created_at`, `updated_at`, `last_edited_time`) plus dynamic columns created from your Notion properties.

## Usage

### Basic Sync

```bash
# Run incremental sync (creates columns automatically)
node index.js sync

# Force full sync
node index.js sync --full

# Dry run (no database changes)
node index.js sync --dry-run

# Limit number of pages
node index.js sync --max-pages=50
```

### Get Statistics

```bash
node index.js stats
```

### Cleanup Old Records

```bash
# Clean up records older than 30 days (default)
node index.js cleanup

# Clean up records older than 60 days
node index.js cleanup --days=60
```

### Programmatic Usage

```javascript
const NotionSupabaseSync = require('./index');

const sync = new NotionSupabaseSync({
  notionToken: 'your_token',
  notionDatabaseId: 'your_database_id',
  supabaseUrl: 'your_supabase_url',
  supabaseAnonKey: 'your_anon_key',
  tableName: 'custom_table_name'
});

// Initialize and sync (columns created automatically)
await sync.initialize();
const result = await sync.sync({
  forceFullSync: false,
  dryRun: false,
  maxPages: 100
});

console.log('Sync result:', result);
```

## Configuration Options

| Option | Environment Variable | Default | Description |
|--------|---------------------|---------|-------------|
| `notionToken` | `NOTION_TOKEN` | - | Notion integration token |
| `notionDatabaseId` | `NOTION_DATABASE_ID` | - | Notion database ID |
| `supabaseUrl` | `SUPABASE_URL` | - | Supabase project URL |
| `supabaseAnonKey` | `SUPABASE_ANON_KEY` | - | Supabase anonymous key |
| `tableName` | - | `notion_pages` | Target table name |
| `batchSize` | `SYNC_BATCH_SIZE` | `100` | Pages per batch |
| `maxRetries` | `MAX_RETRIES` | `3` | Maximum retry attempts |
| `retryDelay` | `RETRY_DELAY_MS` | `1000` | Retry delay in ms |
| `logLevel` | `LOG_LEVEL` | `info` | Logging level |

## Automatic Column Creation

The script automatically creates Supabase columns based on your Notion database structure:

### Schema Detection
```javascript
// The script fetches your Notion database structure
const databaseSchema = await notionService.getDatabaseSchema(databaseId);
// Returns: { properties: { "Name": { type: "title" }, "Status": { type: "select" } } }
```

### Column Creation
```javascript
// For each Notion property, it creates a corresponding Supabase column
for (const [propertyName, propertyConfig] of Object.entries(databaseSchema.properties)) {
    const columnName = convertToSnakeCase(propertyName);
    const columnType = mapNotionTypeToSupabaseType(propertyConfig.type);
    
    // Automatically runs: ALTER TABLE notion_pages ADD COLUMN IF NOT EXISTS columnName columnType;
}
```

### Type Mapping
| Notion Property | Supabase Column Type | Example |
|----------------|---------------------|---------|
| **Title** | `TEXT` | "Project Name" |
| **Rich Text** | `TEXT` | "Description content" |
| **Select** | `TEXT` | "In Progress" |
| **Multi-select** | `TEXT[]` | `["urgent", "frontend"]` |
| **Date** | `TIMESTAMP WITH TIME ZONE` | `2024-01-15T10:30:00Z` |
| **Checkbox** | `BOOLEAN` | `true` |
| **Number** | `NUMERIC` | `42` |
| **URL** | `TEXT` | `https://example.com` |
| **Email** | `TEXT` | `user@example.com` |
| **Files** | `TEXT[]` | `["url1", "url2"]` |
| **People** | `TEXT[]` | `["user_id_1", "user_id_2"]` |

## Data Transformation

The script automatically transforms Notion properties to Supabase-compatible formats:

- **Text properties**: Extracted as plain text
- **Select/Multi-select**: Converted to strings/arrays
- **Dates**: Converted to ISO timestamps
- **Files**: URLs extracted
- **People**: User IDs extracted
- **Numbers**: Preserved as numbers
- **Checkboxes**: Converted to booleans

Property names are automatically converted to snake_case for database compatibility.

## Logging

The script uses Winston for structured logging with:

- **Console output**: Colored, formatted logs
- **File rotation**: Daily log files with compression
- **Error tracking**: Separate error log files
- **Log levels**: error, warn, info, debug

Logs are stored in the `logs/` directory:

```
logs/
├── application-2024-01-15.log
├── error-2024-01-15.log
├── exceptions-2024-01-15.log
└── rejections-2024-01-15.log
```

## Error Handling

The script includes comprehensive error handling:

- **Retry logic**: Exponential backoff with jitter
- **Rate limiting**: Respects API rate limits
- **Connection validation**: Validates both Notion and Supabase connections
- **Data validation**: Validates transformed data before insertion
- **Graceful degradation**: Continues processing even if some records fail
- **Schema validation**: Validates column creation and data types

## Monitoring

The sync process provides detailed statistics:

```json
{
  "success": true,
  "startTime": "2024-01-15T10:30:00.000Z",
  "endTime": "2024-01-15T10:32:15.000Z",
  "duration": 135000,
  "durationSeconds": 135,
  "stats": {
    "totalFetched": 150,
    "totalTransformed": 148,
    "totalSynced": 148,
    "transformationRate": "98.67",
    "syncRate": "100.00"
  },
  "schema": {
    "created": 5,
    "existing": 8,
    "totalColumns": 13
  }
}
```

## Production Deployment

### Environment Variables

Ensure all required environment variables are set in your production environment.

### Cron Job Setup

For regular syncing, set up a cron job:

```bash
# Sync every hour
0 * * * * cd /path/to/notion-supabase-sync && node index.js sync

# Sync daily at 2 AM
0 2 * * * cd /path/to/notion-supabase-sync && node index.js sync
```

### Docker Deployment

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

CMD ["node", "index.js", "sync"]
```

### Health Checks

Monitor the sync process:

```bash
# Check sync status
node index.js stats

# View recent logs
tail -f logs/application-$(date +%Y-%m-%d).log
```

## Troubleshooting

### Common Issues

1. **Invalid Notion Token**
   - Verify the token is correct
   - Ensure the integration has access to the database

2. **Supabase Connection Issues**
   - Check URL and anon key
   - Verify network connectivity
   - Check RLS policies

3. **Column Creation Errors**
   - **Error:** `"Could not find the 'archived' column"`
   - **Solution:** Run the `setup-database.sql` script in Supabase SQL Editor
   - Check for reserved SQL keywords in property names
   - Verify the base table exists

4. **Rate Limiting**
   - The script includes automatic retry logic
   - Increase `RETRY_DELAY_MS` if needed

5. **Data Transformation Errors**
   - Check logs for specific property issues
   - Verify Notion database structure

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug node index.js sync
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:

1. Check the logs for error details
2. Review the troubleshooting section
3. Open an issue with detailed information

## Changelog

### v1.2.0
- ✅ **Automatic column creation** using `exec_sql` function
- ✅ **System fields filtering** - removes `archived`, `created_by`, etc. from database columns
- ✅ **Simplified setup** - single `setup-database.sql` script
- ✅ **Clean codebase** - removed test files and unnecessary functions
- ✅ **Simplified schema** - removed unused `title`, `properties`, `raw_data` fields

### v1.1.0
- ✅ **Automatic column creation** using `exec_sql` function
- ✅ **System fields filtering** - removes `archived`, `created_by`, etc. from database columns
- ✅ **Simplified setup** - single `setup-database.sql` script

### v1.0.0
- ✅ **Incremental sync** with timestamp tracking
- ✅ **Automatic schema detection** from Notion database
- ✅ **Data transformation** for all Notion property types
- ✅ **Error handling** with retry logic
- ✅ **Comprehensive logging** with Winston 

## Security

### Row Level Security (RLS)

The setup script enables RLS on both tables with the following policies:

**`notion_pages` table:**
- ✅ **Service Role**: Full access (for sync script)
- ✅ **Authenticated Users**: Full access (for your application)
- ❌ **Public**: No access (secure by default)

**`sync_state` table:**
- ✅ **Service Role**: Full access (for sync script)
- ✅ **Authenticated Users**: Full access (for your application)
- ❌ **Public**: No access (secure by default)

### Accessing Data

**From your application:**
```javascript
// Use authenticated user credentials with anon key
const supabase = createClient(url, anonKey, {
  auth: { autoRefreshToken: true }
});

// Read synced data
const { data } = await supabase
  .from('notion_pages')
  .select('*');

// Write/update data
const { data: updatedData } = await supabase
  .from('notion_pages')
  .upsert({ 
    notion_id: 'your-notion-id',
    title_of_content_page: 'Updated Title'
  });

// Check sync status
const { data: syncState } = await supabase
  .from('sync_state')
  .select('*');
```

**From sync script:**
```javascript
// Uses service role key automatically (bypasses RLS)
// No changes needed to your sync script
// The script uses SUPABASE_SERVICE_ROLE_KEY from environment
```

### Customizing Security

To modify access levels, edit the policies in `setup-database.sql` or run `secure-tables.sql` separately. 