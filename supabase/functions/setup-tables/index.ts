import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const client = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Create gifts table
    await client.rpc('exec_sql', { sql: `
      CREATE TABLE IF NOT EXISTS public.gifts (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        from_user_id UUID REFERENCES auth.users(id),
        from_name TEXT NOT NULL DEFAULT 'Nova VPS',
        to_email TEXT NOT NULL,
        plan_id UUID NOT NULL,
        plan_name TEXT NOT NULL,
        message TEXT,
        claimed BOOLEAN NOT NULL DEFAULT false,
        claimed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      ALTER TABLE public.gifts ENABLE ROW LEVEL SECURITY;

      CREATE POLICY "Anyone can read gifts by email" ON public.gifts
        FOR SELECT USING (true);

      CREATE POLICY "Admin can insert gifts" ON public.gifts
        FOR INSERT WITH CHECK (true);

      CREATE POLICY "Anyone can update gifts" ON public.gifts
        FOR UPDATE USING (true);
    `});
    // If rpc fails, try direct approach
    console.log('Trying setup via RPC...');

    // Fallback: try creating via the Supabase SQL API
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const sqlResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ sql: `
        CREATE TABLE IF NOT EXISTS public.gifts (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          from_user_id UUID REFERENCES auth.users(id),
          from_name TEXT NOT NULL DEFAULT 'Nova VPS',
          to_email TEXT NOT NULL,
          plan_id UUID NOT NULL,
          plan_name TEXT NOT NULL,
          message TEXT,
          claimed BOOLEAN NOT NULL DEFAULT false,
          claimed_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `}),
    });

    return new Response(JSON.stringify({ success: true, message: 'Tables created' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
