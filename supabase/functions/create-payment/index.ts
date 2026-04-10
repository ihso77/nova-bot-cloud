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

    const { planId, amount, userId } = await req.json();

    if (!planId || !userId) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const PAYMENTO_API_KEY = Deno.env.get('PAYMENTO_API_KEY');
    const PAYMENTO_SECRET_KEY = Deno.env.get('PAYMENTO_SECRET_KEY');

    if (!PAYMENTO_API_KEY || !PAYMENTO_SECRET_KEY) {
      // If Paymento keys not configured, create subscription directly
      const { error } = await supabaseClient.from('subscriptions').insert({
        user_id: userId,
        plan_id: planId,
        status: 'active',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Try Paymento API
    try {
      const paymentRes = await fetch('https://api.paymento.io/v1/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${PAYMENTO_API_KEY}`,
          'X-Secret-Key': PAYMENTO_SECRET_KEY,
        },
        body: JSON.stringify({
          amount: amount,
          currency: 'USD',
          description: `Nova VPS - Plan subscription`,
          metadata: { planId, userId },
          success_url: `${Deno.env.get('SITE_URL') || 'https://novavps.app'}/dashboard`,
          cancel_url: `${Deno.env.get('SITE_URL') || 'https://novavps.app'}/plans`,
        }),
      });

      if (paymentRes.ok) {
        const paymentData = await paymentRes.json();
        return new Response(JSON.stringify({ paymentUrl: paymentData.url || paymentData.payment_url }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } catch (e) {
      console.error('Paymento error:', e);
    }

    // Fallback: create subscription directly
    const { error } = await supabaseClient.from('subscriptions').insert({
      user_id: userId,
      plan_id: planId,
      status: 'active',
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
