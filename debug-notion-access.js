#!/usr/bin/env node

require('dotenv').config();
const { Client } = require('@notionhq/client');

/**
 * Debug script to troubleshoot Notion database access
 */
async function debugNotionAccess() {
  const token = process.env.NOTION_TOKEN;
  const databaseId = process.env.NOTION_DATABASE_ID;
  
  if (!token) {
    console.error('❌ NOTION_TOKEN environment variable is not set');
    return;
  }
  
  if (!databaseId) {
    console.error('❌ NOTION_DATABASE_ID environment variable is not set');
    return;
  }
  
  console.log('🔍 Debugging Notion Access...');
  console.log('📋 Configuration:');
  console.log(`   Token: ${token.substring(0, 10)}...${token.substring(token.length - 10)}`);
  console.log(`   Database ID: ${databaseId}`);
  console.log(`   Database ID length: ${databaseId.length}`);
  console.log(`   Database ID format: ${databaseId.includes('-') ? 'With dashes' : 'Without dashes'}`);
  
  const client = new Client({ auth: token });
  
  try {
    // Test 1: Validate token by getting user info
    console.log('\n🔐 Testing token validity...');
    const user = await client.users.me();
    console.log('✅ Token is valid');
    console.log(`   User: ${user.name || 'Unknown'} (${user.type})`);
    
    // Test 2: Try to retrieve the database
    console.log('\n🗄️ Testing database access...');
    console.log(`   Attempting to access database: ${databaseId}`);
    
    const database = await client.databases.retrieve({ database_id: databaseId });
    console.log('✅ Database access successful!');
    console.log(`   Database title: ${database.title[0]?.plain_text || 'Untitled'}`);
    console.log(`   Database type: ${database.object}`);
    console.log(`   Created by: ${database.created_by.name || 'Unknown'}`);
    console.log(`   Last edited: ${new Date(database.last_edited_time).toLocaleString()}`);
    
    // Test 3: Try to query the database
    console.log('\n📄 Testing database query...');
    const query = await client.databases.query({ database_id: databaseId, page_size: 5 });
    console.log('✅ Database query successful!');
    console.log(`   Found ${query.results.length} pages`);
    console.log(`   Has more: ${query.has_more}`);
    
    if (query.results.length > 0) {
      console.log('   Sample pages:');
      query.results.slice(0, 3).forEach((page, index) => {
        const title = page.properties.title?.title?.[0]?.plain_text || 
                     page.properties.Name?.title?.[0]?.plain_text ||
                     'Untitled';
        console.log(`     ${index + 1}. ${title} (${page.id})`);
      });
    }
    
    console.log('\n🎉 All tests passed! Your Notion integration is working correctly.');
    
  } catch (error) {
    console.error('\n❌ Error occurred:');
    console.error(`   Code: ${error.code}`);
    console.error(`   Message: ${error.message}`);
    
    if (error.code === 'object_not_found') {
      console.log('\n💡 Troubleshooting suggestions:');
      console.log('   1. Check if the database ID is correct');
      console.log('   2. Ensure the database is shared with your integration');
      console.log('   3. Verify the database exists and hasn\'t been deleted');
      console.log('   4. Try copying the database ID from the Notion URL');
      
      console.log('\n🔧 How to fix:');
      console.log('   1. Go to your Notion database');
      console.log('   2. Click "Share" in the top right');
      console.log('   3. Click "Invite" and search for your integration name');
      console.log('   4. Select your integration and click "Invite"');
      console.log('   5. Make sure the integration has "Can edit" permissions');
      
    } else if (error.code === 'unauthorized') {
      console.log('\n💡 Your token might be invalid or expired');
      console.log('   1. Check your NOTION_TOKEN environment variable');
      console.log('   2. Regenerate your integration token in Notion');
      
    } else {
      console.log('\n💡 Unknown error - check your configuration');
    }
  }
}

// Run the debug script
if (require.main === module) {
  debugNotionAccess().catch(console.error);
}

module.exports = { debugNotionAccess }; 