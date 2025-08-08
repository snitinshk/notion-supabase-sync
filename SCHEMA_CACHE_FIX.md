# Schema Cache Issue Fix

## Problem Description

The error you encountered:
```
Could not find the 'header_image_and_thumbnail' column of 'wheeltribe_content' in the schema cache
```

This is a common issue with Supabase's PostgREST API. When columns are created using ALTER TABLE statements, PostgREST doesn't automatically refresh its schema cache, causing subsequent operations to fail with "schema cache" errors.

## Root Cause

1. **PostgREST Schema Caching**: PostgREST caches database schema information for performance
2. **Cache Invalidation**: When columns are added via ALTER TABLE, the cache isn't automatically refreshed
3. **Error Code PGRST204**: This specific error indicates a schema cache mismatch

## Solution Implemented

### 1. Schema Cache Refresh Method

Added `refreshSchemaCache()` method to `SupabaseService` that:
- Attempts to trigger cache refresh by querying non-existent columns
- Makes a simple query to refresh the connection
- Provides detailed logging for debugging

### 2. Automatic Error Recovery

Enhanced error handling in `upsertData()` method:
- Detects PGRST204 schema cache errors
- Automatically refreshes schema cache
- Retries the operation after cache refresh
- Provides comprehensive error logging

### 3. Manual Schema Refresh

Added `refreshSchema()` method to the main sync class:
- Can be called manually when needed
- Available as a command-line option
- Useful for troubleshooting

### 4. Debug Tools

Created `debug-schema-cache.js` script that:
- Tests all connections and schema operations
- Identifies missing columns
- Tests schema cache refresh functionality
- Provides detailed diagnostics

## Usage

### Automatic Recovery
The sync process now automatically handles schema cache errors:
```bash
node index.js sync
```

### Manual Schema Refresh
If you encounter schema cache issues, manually refresh:
```bash
node index.js refresh-schema
```

### Debug and Diagnose
Run the debug script to identify issues:
```bash
npm run debug
# or
node debug-schema-cache.js
```

## Files Modified

1. **services/supabaseService.js**
   - Added `refreshSchemaCache()` method
   - Enhanced `upsertData()` with automatic error recovery
   - Added schema cache refresh after column creation

2. **utils/schemaManager.js**
   - Added `handleSchemaCacheError()` method
   - Improved error handling and recovery

3. **index.js**
   - Added `refreshSchema()` method
   - Added schema cache refresh during initialization
   - Added `refresh-schema` command-line option

4. **debug-schema-cache.js** (new)
   - Comprehensive debugging script
   - Tests all schema operations
   - Provides detailed diagnostics

5. **package.json**
   - Added `debug` script

## Testing the Fix

1. **Run the debug script**:
   ```bash
   npm run debug
   ```

2. **Test manual schema refresh**:
   ```bash
   node index.js refresh-schema
   ```

3. **Run a full sync**:
   ```bash
   node index.js sync --full
   ```

## Expected Behavior

After the fix:
- ✅ Schema cache errors are automatically detected and handled
- ✅ Missing columns are created and cache is refreshed
- ✅ Sync operations retry automatically after cache refresh
- ✅ Detailed logging helps identify any remaining issues

## Troubleshooting

If you still encounter issues:

1. **Check the debug output**:
   ```bash
   npm run debug
   ```

2. **Manually refresh schema**:
   ```bash
   node index.js refresh-schema
   ```

3. **Check logs** for detailed error information

4. **Verify column creation** in Supabase dashboard

## Prevention

The system now:
- Automatically refreshes schema cache after column creation
- Handles schema cache errors gracefully
- Provides manual refresh options
- Includes comprehensive debugging tools

This should resolve the "header_image_and_thumbnail" column error and prevent similar issues in the future.
