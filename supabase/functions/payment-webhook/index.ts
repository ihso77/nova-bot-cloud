import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only accept POST requests from Paymento webhook
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const PAYMENTO_WEBHOOK_SECRET = Deno.env.get('PAYMENTO_WEBHOOK_SECRET');

    // Verify webhook signature if secret is configured
    if (PAYMENTO_WEBHOOK_SECRET) {
      const signature = req.headers.get('X-Webhook-Signature') || req.headers.get('x-webhook-signature');
      if (!signature || signature !== PAYMENTO_WEBHOOK_SECRET) {
        console.error('Invalid webhook signature');
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const payload = await req.json();
    console.log('Webhook received:', JSON.stringify(payload));

    // Paymento webhook payload structure
    const paymentId = payload.id || payload.payment_id;
    const status = payload.status?.toLowerCase();
    const metadata = payload.metadata || {};

    if (!paymentId) {
      console.error('No payment ID in webhook payload');
      return new Response(JSON.stringify({ error: 'Missing payment ID' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update payment status
    await supabaseClient.from('payments').update({
      status: status,
      updated_at: new Date().toISOString(),
      raw_response: JSON.stringify(payload),
    }).eq('id', paymentId);

    // Handle successful payment
    if (status === 'paid' || status === 'completed' || status === 'success') {
      const userId = metadata.userId || payload.user_id;
      const planId = metadata.planId || payload.plan_id;

      if (!userId || !planId) {
        console.error('Missing userId or planId in webhook:', payload);
        return new Response(JSON.stringify({ error: 'Missing metadata' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check if subscription already exists for this payment (prevent duplicates)
      const { data: existingSub } = await supabaseClient
        .from('subscriptions')
        .select('id')
        .eq('user_id', userId)
        .eq('plan_id', planId)
        .eq('status', 'active')
        .limit(1);

      if (existingSub && existingSub.length > 0) {
        console.log('Subscription already active for this user and plan');
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Create the subscription (30 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const { error: subError } = await supabaseClient.from('subscriptions').insert({
        user_id: userId,
        plan_id: planId,
        status: 'active',
        expires_at: expiresAt.toISOString(),
        is_free_trial: false,
        payment_id: paymentId,
      });

      if (subError) {
        console.error('Failed to create subscription:', subError);
        return new Response(JSON.stringify({ error: 'Failed to create subscription' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('Subscription created successfully for user:', userId, 'plan:', planId);
    }

    // Handle failed payment
    if (status === 'failed' || status === 'cancelled' || status === 'expired') {
      console.log('Payment failed/cancelled:', paymentId, 'status:', status);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
