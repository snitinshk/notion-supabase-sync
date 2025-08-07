import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Initialize Supabase client with built-in environment variables
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const notionToken = Deno.env.get('NOTION_TOKEN');
const notionDatabaseId = Deno.env.get('NOTION_DATABASE_ID');

// Validate required environment variables
if (!notionToken) throw new Error('NOTION_TOKEN environment variable is required');
if (!notionDatabaseId) throw new Error('NOTION_DATABASE_ID environment variable is required');

// Note: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are automatically available
if (!supabaseUrl) throw new Error('SUPABASE_URL should be automatically available');
if (!supabaseServiceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY should be automatically available');

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// Simple Notion API client using fetch (working approach)
async function notionRequest(endpoint: string, options: any = {}) {
  const url = `https://api.notion.com/v1${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${notionToken}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Notion API error: ${response.status} ${response.statusText} - ${errorText}`);
  }
  
  return response.json();
}

// Data transformation utilities
function convertToSnakeCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .toLowerCase();
}

function transformNotionProperty(property: any, propertyName: string): any {
  const propertyType = property.type;
  
  switch (propertyType) {
    case 'title':
      return property.title?.[0]?.plain_text || '';
    case 'rich_text':
      return property.rich_text?.[0]?.plain_text || '';
    case 'select':
      return property.select?.name || null;
    case 'multi_select':
      return property.multi_select?.map((item: any) => item.name) || [];
    case 'date':
      return property.date?.start || null;
    case 'checkbox':
      return property.checkbox || false;
    case 'number':
      return property.number || null;
    case 'url':
      return property.url || null;
    case 'email':
      return property.email || null;
    case 'phone_number':
      return property.phone_number || null;
    case 'status':
      return property.status?.name || null;
    default:
      console.warn(`Unknown Notion type: ${propertyType}`);
      return null;
  }
}

function transformNotionPage(page: any): any {
  const transformed: any = {
    notion_id: page.id,
    created_at: page.created_time,
    updated_at: page.last_edited_time,
    last_edited_time: page.last_edited_time
  };

  // Transform each property
  for (const [propertyName, property] of Object.entries(page.properties)) {
    // Skip Notion system fields
    const systemFields = ['archived', 'icon', 'cover', 'parent', 'object', 'type', 'created_by', 'last_edited_by', 'in_trash', 'url', 'public_url'];
    if (systemFields.includes(propertyName)) continue;

    const snakeCaseName = convertToSnakeCase(propertyName);
    const transformedValue = transformNotionProperty(property, propertyName);
    
    if (transformedValue !== null && transformedValue !== undefined) {
      transformed[snakeCaseName] = transformedValue;
    }
  }

  return transformed;
}

// Sync state management
async function getLastSyncTime(databaseId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('sync_state')
      .select('last_sync_time')
      .eq('database_id', databaseId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data?.last_sync_time || null;
  } catch (error) {
    console.error('Error getting last sync time:', error);
    return null;
  }
}

async function updateSyncTime(databaseId: string, syncTime: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('sync_state')
      .upsert({
        database_id: databaseId,
        last_sync_time: syncTime,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'database_id'
      });

    if (error) throw error;
  } catch (error) {
    console.error('Error updating sync time:', error);
    throw error;
  }
}



// Main sync function
async function syncNotionToSupabase(forceFullSync = false, maxPages: number | null = null) {
  try {
    console.log('Starting Notion to Supabase sync...');
    console.log('Environment variables:', {
      supabaseUrl: supabaseUrl ? 'SET' : 'MISSING',
      supabaseServiceRoleKey: supabaseServiceRoleKey ? 'SET' : 'MISSING',
      notionToken: notionToken ? 'SET' : 'MISSING',
      notionDatabaseId: notionDatabaseId ? 'SET' : 'MISSING'
    });
    
    const tableName = 'notion_pages';
    
    // Get last sync time (unless force full sync)
    const lastSyncTime = forceFullSync ? null : await getLastSyncTime(notionDatabaseId);
    
    console.log('Sync parameters:', {
      databaseId: notionDatabaseId,
      lastSyncTime,
      forceFullSync,
      maxPages
    });

    // Build Notion query
    const queryParams: any = {
      database_id: notionDatabaseId,
      page_size: 100
    };

    // Add filter for incremental sync
    if (lastSyncTime && !forceFullSync) {
      queryParams.filter = {
        timestamp: 'last_edited_time',
        last_edited_time: {
          on_or_after: lastSyncTime
        }
      };
    }

    // Get pages from Notion using direct fetch (like debug function)
    console.log('Querying Notion database...');
    
    // Use the exact same approach as the working debug function
    const response = await fetch('https://api.notion.com/v1/databases/' + notionDatabaseId + '/query', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notionToken}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        page_size: 100,
        ...(lastSyncTime && !forceFullSync ? {
          filter: {
            timestamp: 'last_edited_time',
            last_edited_time: {
              on_or_after: lastSyncTime
            }
          }
        } : {})
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Notion API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const responseData = await response.json();
    let allPages = responseData.results;
    
    // Handle pagination
    while (responseData.has_more && responseData.next_cursor) {
      const nextResponse = await fetch('https://api.notion.com/v1/databases/' + notionDatabaseId + '/query', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${notionToken}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          page_size: 100,
          start_cursor: responseData.next_cursor,
          ...(lastSyncTime && !forceFullSync ? {
            filter: {
              timestamp: 'last_edited_time',
              last_edited_time: {
                on_or_after: lastSyncTime
              }
            }
          } : {})
        })
      });
      if (!nextResponse.ok) {
        const errorText = await nextResponse.text();
        throw new Error(`Notion API error: ${nextResponse.status} ${nextResponse.statusText} - ${errorText}`);
      }
      const nextResponseData = await nextResponse.json();
      allPages = allPages.concat(nextResponseData.results);
      responseData.has_more = nextResponseData.has_more;
      responseData.next_cursor = nextResponseData.next_cursor;
    }

    // Limit pages if specified
    if (maxPages) {
      allPages = allPages.slice(0, maxPages);
    }

    console.log(`Found ${allPages.length} pages to sync`);

    if (allPages.length === 0) {
      console.log('No pages to sync');
      return {
        success: true,
        pagesProcessed: 0,
        message: 'No pages to sync'
      };
    }

    // Transform pages
    const transformedPages = allPages.map(transformNotionPage);
    console.log(`Transformed ${transformedPages.length} pages`);

    // Upsert to Supabase
    console.log('Upserting to Supabase...');
    const { data, error } = await supabase
      .from(tableName)
      .upsert(transformedPages, { 
        onConflict: 'notion_id',
        ignoreDuplicates: false 
      });

    if (error) {
      throw new Error(`Supabase error: ${error.message}`);
    }

    // Update sync state
    await updateSyncTime(notionDatabaseId, new Date().toISOString());

    console.log('Sync completed successfully');
    
    return {
      success: true,
      pagesProcessed: transformedPages.length,
      message: 'Notion to Supabase sync completed successfully',
      stats: {
        totalFetched: allPages.length,
        totalTransformed: transformedPages.length,
        totalSynced: transformedPages.length
      }
    };
    
  } catch (error) {
    console.error('Error in sync function:', error);
    throw error;
  }
}

// Deno Edge Function handler
Deno.serve(async (req) => {
  try {
    console.log('Function invoked');
    
    // Parse request body for options
    let options = { forceFullSync: false, maxPages: null };
    
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        options = { ...options, ...body };
        console.log('Request options:', options);
      } catch (e) {
        console.log('No request body or invalid JSON, using defaults');
      }
    }

    const result = await syncNotionToSupabase(options.forceFullSync, options.maxPages);
    
    return new Response(
      JSON.stringify(result),
      { 
        headers: { "Content-Type": "application/json" },
        status: 200
      }
    );
    
  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      }),
      { 
        headers: { "Content-Type": "application/json" },
        status: 500
      }
    );
  }
}); 