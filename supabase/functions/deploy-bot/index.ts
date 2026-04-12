import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeployRequest {
  projectId: string;
  userId: string;
  files: { file_name: string; content: string }[];
  language: string;
  botToken: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body: DeployRequest = await req.json();
    const { projectId, userId, files, language, botToken } = body;

    if (!projectId || !userId || !files || files.length === 0) {
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

    // Update project status to deploying
    await supabaseClient
      .from('projects')
      .update({ status: 'deploying' })
      .eq('id', projectId);

    // Check if Railway API token is configured
    const RAILWAY_API_TOKEN = Deno.env.get('RAILWAY_API_TOKEN');
    const RAILWAY_PROJECT_ID = Deno.env.get('RAILWAY_PROJECT_ID');

    if (RAILWAY_API_TOKEN && RAILWAY_PROJECT_ID) {
      // Real Railway deployment
      try {
        const mainFile = files.find(f => 
          f.file_name === 'index.js' || f.file_name === 'index.ts' || 
          f.file_name === 'bot.py' || f.file_name === 'main.py' ||
          f.file_name === 'main.js' || f.file_name === 'main.ts'
        );

        if (!mainFile) {
          throw new Error('No main file found (index.js, bot.py, etc.)');
        }

        // Determine runtime based on language
        const runtimeMap: Record<string, string> = {
          'javascript': 'NODE',
          'typescript': 'NODE',
          'python': 'PYTHON',
        };
        const runtime = runtimeMap[language] || 'NODE';

        // Build the project files content
        let fullContent = mainFile.content;
        
        // Inject bot token
        if (language === 'python') {
          fullContent = fullContent.replace(/['"]YOUR_TOKEN['"]/, `'${botToken}'`);
        } else {
          fullContent = fullContent.replace(/['"]YOUR_TOKEN['"]/, `'${botToken}'`);
        }

        // Create Railway service
        const createServiceRes = await fetch('https://graphql.railway.app/v2/graphql', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RAILWAY_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: `
              mutation CreateService($projectId: String!, $name: String!) {
                createService(projectId: $projectId, name: $name) {
                  id
                }
              }
            `,
            variables: {
              projectId: RAILWAY_PROJECT_ID,
              name: `bot-${projectId.slice(0, 8)}`,
            },
          }),
        });

        const serviceData = await createServiceRes.json();
        const serviceId = serviceData?.data?.createService?.id;

        if (!serviceId) {
          throw new Error('Failed to create Railway service');
        }

        // Update project with railway service id
        await supabaseClient
          .from('projects')
          .update({ railway_service_id: serviceId })
          .eq('id', projectId);

        // Create environment variables for the service
        await fetch('https://graphql.railway.app/v2/graphql', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RAILWAY_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: `
              mutation UpsertEnvVars($serviceId: String!, $projectId: String!, $environmentId: String!, $data: JSON!) {
                upsertEnvironmentVariables(
                  serviceId: $serviceId
                  projectId: $projectId
                  environmentId: $environmentId
                  data: $data
                )
              }
            `,
            variables: {
              serviceId,
              projectId: RAILWAY_PROJECT_ID,
              environmentId: 'production',
              data: JSON.stringify({
                DISCORD_TOKEN: botToken,
                BOT_LANGUAGE: language,
              }),
            },
          }),
        });

        // Deploy the bot
        await fetch('https://graphql.railway.app/v2/graphql', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RAILWAY_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: `
              mutation Redeploy($serviceId: String!) {
                serviceRedeploy(serviceId: $serviceId)
              }
            `,
            variables: { serviceId },
          }),
        });

        // Update status to running
        await supabaseClient
          .from('projects')
          .update({ status: 'running' })
          .eq('id', projectId);

        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Bot deployed to Railway',
          serviceId 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } catch (railwayError: any) {
        console.error('Railway deployment error:', railwayError);
        
        // Update status to error
        await supabaseClient
          .from('projects')
          .update({ status: 'error' })
          .eq('id', projectId);

        return new Response(JSON.stringify({ 
          error: 'Railway deployment failed: ' + railwayError.message 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      // Simulated deployment mode (no Railway configured)
      // Still validate the bot code
      const mainFile = files.find(f => 
        f.file_name === 'index.js' || f.file_name === 'index.ts' || 
        f.file_name === 'bot.py' || f.file_name === 'main.py' ||
        f.file_name === 'main.js' || f.file_name === 'main.ts'
      );

      if (!mainFile) {
        await supabaseClient
          .from('projects')
          .update({ status: 'error' })
          .eq('id', projectId);

        return new Response(JSON.stringify({ 
          error: 'لم يتم العثور على الملف الرئيسي (index.js, bot.py, إلخ)' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Validate bot token format (basic check)
      if (!botToken || botToken.length < 50) {
        await supabaseClient
          .from('projects')
          .update({ status: 'error' })
          .eq('id', projectId);

        return new Response(JSON.stringify({ 
          error: 'توكن Discord غير صالح. تأكد من إدخال التوكن الصحيح.' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check if token contains YOUR_TOKEN placeholder
      if (botToken === 'YOUR_TOKEN') {
        await supabaseClient
          .from('projects')
          .update({ status: 'error' })
          .eq('id', projectId);

        return new Response(JSON.stringify({ 
          error: 'يجب استبدال YOUR_TOKEN بتوكن Discord الحقيقي الخاص بك.' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Simulate deployment delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // In simulated mode, mark as running with a note
      await supabaseClient
        .from('projects')
        .update({ status: 'running' })
        .eq('id', projectId);

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Bot started (simulated mode - configure Railway for real deployment)',
        simulated: true 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
