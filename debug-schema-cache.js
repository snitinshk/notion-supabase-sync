#!/usr/bin/env node

require('dotenv').config();
const logger = require('./config/logger');
const NotionService = require('./services/notionService');
const SupabaseService = require('./services/supabaseService');
const SchemaManager = require('./utils/schemaManager');

/**
 * Debug script to test schema cache refresh and diagnose issues
 */
async function debugSchemaCache() {
  try {
    console.log('🔍 Debugging schema cache issues...\n');

    // Initialize services
    const notionService = new NotionService(process.env.NOTION_TOKEN);
    const supabaseService = new SupabaseService(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const tableName = process.env.TABLE_NAME || 'wheeltribe_content';

    console.log('📋 Configuration:');
    console.log(`  Table: ${tableName}`);
    console.log(`  Supabase URL: ${process.env.SUPABASE_URL}`);
    console.log(`  Notion Database: ${process.env.NOTION_DATABASE_ID}\n`);

    // Test 1: Validate connections
    console.log('🔗 Testing connections...');
    const [notionValid, supabaseValid] = await Promise.all([
      notionService.validateToken(),
      supabaseService.validateConnection()
    ]);

    console.log(`  Notion: ${notionValid ? '✅' : '❌'}`);
    console.log(`  Supabase: ${supabaseValid ? '✅' : '❌'}\n`);

    if (!notionValid || !supabaseValid) {
      throw new Error('Connection validation failed');
    }

    // Test 2: Get Notion database schema
    console.log('📊 Fetching Notion database schema...');
    const databaseSchema = await notionService.getDatabaseSchema(process.env.NOTION_DATABASE_ID);
    const requiredColumns = SchemaManager.extractColumnDefinitions(databaseSchema);
    
    console.log(`  Properties found: ${Object.keys(databaseSchema.properties).length}`);
    console.log(`  Columns to create: ${requiredColumns.length}`);
    
    // Show some example columns
    const exampleColumns = requiredColumns.slice(0, 5);
    console.log('  Example columns:');
    exampleColumns.forEach(col => {
      console.log(`    - ${col.originalName} → ${col.name} (${col.type})`);
    });
    console.log('');

    // Test 3: Get existing columns from Supabase
    console.log('🗄️  Checking existing Supabase columns...');
    const existingColumns = await SchemaManager.getExistingColumns(supabaseService, tableName);
    console.log(`  Existing columns: ${existingColumns.length}`);
    console.log(`  Columns: ${existingColumns.join(', ')}\n`);

    // Test 4: Find missing columns
    const missingColumns = SchemaManager.getMissingColumns(requiredColumns, existingColumns);
    console.log(`🔍 Missing columns: ${missingColumns.length}`);
    if (missingColumns.length > 0) {
      missingColumns.slice(0, 5).forEach(col => {
        console.log(`  - ${col.originalName} → ${col.name} (${col.type})`);
      });
      if (missingColumns.length > 5) {
        console.log(`  ... and ${missingColumns.length - 5} more`);
      }
    }
    console.log('');

    // Test 5: Test schema cache refresh
    console.log('🔄 Testing schema cache refresh...');
    const refreshSuccess = await supabaseService.refreshSchemaCache(tableName);
    console.log(`  Schema cache refresh: ${refreshSuccess ? '✅' : '❌'}\n`);

    // Test 6: Try to create missing columns
    if (missingColumns.length > 0) {
      console.log('🔧 Creating missing columns...');
      const columnResult = await supabaseService.createMissingColumns(tableName, databaseSchema);
      console.log(`  Created: ${columnResult.created}`);
      console.log(`  Errors: ${columnResult.errors?.length || 0}`);
      
      if (columnResult.errors) {
        console.log('  Error details:');
        columnResult.errors.forEach((error, index) => {
          console.log(`    ${index + 1}. ${error.error}`);
        });
      }
      console.log('');
    }

    // Test 7: Test a simple query to verify everything works
    console.log('🧪 Testing simple query...');
    try {
      const { data, error } = await supabaseService.client
        .from(tableName)
        .select('id, notion_id')
        .limit(1);
      
      if (error) {
        console.log(`  Query failed: ${error.message}`);
      } else {
        console.log(`  Query successful: ${data?.length || 0} rows returned`);
      }
    } catch (queryError) {
      console.log(`  Query error: ${queryError.message}`);
    }

    console.log('\n✅ Debug completed!');

  } catch (error) {
    console.error('\n❌ Debug failed:', error.message);
    logger.error('Debug script failed', { error: error.message });
    process.exit(1);
  }
}

// Run the debug script
if (require.main === module) {
  debugSchemaCache();
}

module.exports = { debugSchemaCache };
