import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { projectId, userId } = await req.json();

    if (!projectId || !userId) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify project belongs to user
    const { data: project, error: projectError } = await supabaseClient
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();

    if (projectError || !project) {
      return new Response(JSON.stringify({ error: 'Project not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if Railway API token is configured
    const RAILWAY_API_TOKEN = Deno.env.get('RAILWAY_API_TOKEN');

    if (RAILWAY_API_TOKEN && project.railway_service_id) {
      // Real Railway stop
      try {
        await fetch('https://graphql.railway.app/v2/graphql', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RAILWAY_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: `
              mutation ServiceInstanceDelete($serviceId: String!, $environmentId: String!) {
                serviceInstanceDelete(serviceId: $serviceId, environmentId: $environmentId)
              }
            `,
            variables: {
              serviceId: project.railway_service_id,
              environmentId: 'production',
            },
          }),
        });
      } catch (e) {
        console.error('Railway stop error:', e);
      }
    }

    // Update status to stopped regardless
    await supabaseClient
      .from('projects')
      .update({ status: 'stopped' })
      .eq('id', projectId);

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Bot stopped successfully' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
