// Simple test to check environment variables
Deno.serve(async (req) => {
  const envVars = {
    SUPABASE_URL: Deno.env.get('SUPABASE_URL') ? 'SET' : 'MISSING',
    SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ? 'SET' : 'MISSING',
    NOTION_TOKEN: Deno.env.get('NOTION_TOKEN') ? 'SET' : 'MISSING',
    NOTION_DATABASE_ID: Deno.env.get('NOTION_DATABASE_ID') ? 'SET' : 'MISSING'
  };

  return new Response(
    JSON.stringify({
      success: true,
      environment: envVars,
      message: 'Environment variables check'
    }),
    { 
      headers: { "Content-Type": "application/json" },
      status: 200
    }
  );
}); 