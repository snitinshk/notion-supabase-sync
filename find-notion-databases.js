#!/usr/bin/env node

require('dotenv').config();
const { Client } = require('@notionhq/client');

/**
 * Script to find all accessible databases in Notion workspace
 */
async function findNotionDatabases() {
  const token = process.env.NOTION_TOKEN;
  
  if (!token) {
    console.error('❌ NOTION_TOKEN environment variable is not set');
    return;
  }
  
  console.log('🔍 Searching for accessible databases...');
  
  const client = new Client({ auth: token });
  
  try {
    // Search for all databases
    console.log('\n📋 Searching for databases...');
    const searchResponse = await client.search({
      filter: {
        property: 'object',
        value: 'database'
      },
      sort: {
        direction: 'descending',
        timestamp: 'last_edited_time'
      }
    });
    
    console.log(`✅ Found ${searchResponse.results.length} databases:`);
    
    if (searchResponse.results.length === 0) {
      console.log('\n💡 No databases found. This could mean:');
      console.log('   1. Your integration doesn\'t have access to any databases');
      console.log('   2. No databases exist in your workspace');
      console.log('   3. You need to share databases with your integration');
      
      console.log('\n🔧 To share a database with your integration:');
      console.log('   1. Go to your Notion database');
      console.log('   2. Click "Share" in the top right');
      console.log('   3. Click "Invite" and search for your integration name');
      console.log('   4. Select your integration and click "Invite"');
      console.log('   5. Make sure the integration has "Can edit" permissions');
      
      return;
    }
    
    // Display each database
    searchResponse.results.forEach((database, index) => {
      const title = database.title[0]?.plain_text || 'Untitled Database';
      const id = database.id;
      const lastEdited = new Date(database.last_edited_time).toLocaleString();
      
      console.log(`\n${index + 1}. ${title}`);
      console.log(`   ID: ${id}`);
      console.log(`   Last edited: ${lastEdited}`);
      console.log(`   URL: https://www.notion.so/${id.replace(/-/g, '')}`);
      
      // Show database properties if available
      if (database.properties) {
        const propertyNames = Object.keys(database.properties);
        console.log(`   Properties: ${propertyNames.join(', ')}`);
      }
    });
    
    console.log('\n💡 To use a database:');
    console.log('   1. Copy the ID from the list above');
    console.log('   2. Set it as your NOTION_DATABASE_ID environment variable');
    console.log('   3. Make sure the database is shared with your integration');
    
    // Also search for pages to show the difference
    console.log('\n📄 Searching for pages (for comparison)...');
    const pageSearchResponse = await client.search({
      filter: {
        property: 'object',
        value: 'page'
      },
      sort: {
        direction: 'descending',
        timestamp: 'last_edited_time'
      },
      page_size: 5
    });
    
    console.log(`Found ${pageSearchResponse.results.length} pages (showing first 5):`);
    pageSearchResponse.results.slice(0, 5).forEach((page, index) => {
      const title = page.properties?.title?.title?.[0]?.plain_text || 
                   page.properties?.Name?.title?.[0]?.plain_text ||
                   'Untitled Page';
      const id = page.id;
      
      console.log(`   ${index + 1}. ${title} (ID: ${id})`);
    });
    
  } catch (error) {
    console.error('\n❌ Error occurred:');
    console.error(`   Code: ${error.code}`);
    console.error(`   Message: ${error.message}`);
  }
}

// Run the script
if (require.main === module) {
  findNotionDatabases().catch(console.error);
}

module.exports = { findNotionDatabases }; 