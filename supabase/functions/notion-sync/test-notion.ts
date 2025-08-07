// Simple test to verify Notion API access
Deno.serve(async (req) => {
  try {
    const notionToken = Deno.env.get('NOTION_TOKEN');
    const notionDatabaseId = Deno.env.get('NOTION_DATABASE_ID');
    
    if (!notionToken) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'NOTION_TOKEN not set'
        }),
        { 
          headers: { "Content-Type": "application/json" },
          status: 500
        }
      );
    }

    // Test simple Notion API call
    const response = await fetch('https://api.notion.com/v1/databases/' + notionDatabaseId, {
      headers: {
        'Authorization': `Bearer ${notionToken}`,
        'Notion-Version': '2022-06-28'
      }
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Notion API error: ${response.status} ${response.statusText}`,
          tokenLength: notionToken.length,
          tokenPrefix: notionToken.substring(0, 10) + '...'
        }),
        { 
          headers: { "Content-Type": "application/json" },
          status: 500
        }
      );
    }

    const data = await response.json();
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Notion API connection successful',
        databaseTitle: data.title?.[0]?.plain_text || 'Unknown',
        properties: Object.keys(data.properties || {})
      }),
      { 
        headers: { "Content-Type": "application/json" },
        status: 200
      }
    );
    
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        headers: { "Content-Type": "application/json" },
        status: 500
      }
    );
  }
}); 