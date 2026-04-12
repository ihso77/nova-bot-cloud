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

    if (!planId || !userId || !amount) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const PAYMENTO_API_KEY = Deno.env.get('PAYMENTO_API_KEY');
    const PAYMENTO_SECRET_KEY = Deno.env.get('PAYMENTO_SECRET_KEY');

    if (!PAYMENTO_API_KEY || !PAYMENTO_SECRET_KEY) {
      return new Response(JSON.stringify({
        error: 'بوابة الدفع غير متاحة حالياً. تواصل مع الدعم الفني.',
      }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SITE_URL = Deno.env.get('SITE_URL') || 'https://novavps.app';

    // Create payment via Paymento API
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
        description: `Nova VPS - ${planId} subscription`,
        metadata: { planId, userId },
        success_url: `${SITE_URL}/payment/success?plan=${planId}&user=${userId}`,
        cancel_url: `${SITE_URL}/payment/cancel`,
        webhook_url: `${SITE_URL}/functions/v1/payment-webhook`,
      }),
    });

    if (!paymentRes.ok) {
      const errorText = await paymentRes.text();
      console.error('Paymento API error:', paymentRes.status, errorText);
      return new Response(JSON.stringify({
        error: 'حدث خطأ في الاتصال ببوابة الدفع. حاول مرة أخرى.',
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const paymentData = await paymentRes.json();

    // Store the payment record for tracking
    const paymentId = paymentData.id || paymentData.payment_id;
    if (paymentId) {
      await supabaseClient.from('payments').insert({
        id: paymentId,
        user_id: userId,
        plan_id: planId,
        amount: amount,
        currency: 'USD',
        status: 'pending',
        provider: 'paymento',
        created_at: new Date().toISOString(),
      });
      console.log('Payment record created:', paymentId);
    }

    const paymentUrl = paymentData.url || paymentData.payment_url || paymentData.checkout_url;

    if (!paymentUrl) {
      return new Response(JSON.stringify({
        error: 'لم يتم استلام رابط الدفع من بوابة الدفع.',
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ paymentUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
