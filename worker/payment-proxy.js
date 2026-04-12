// Cloudflare Worker - Nova VPS Payment Proxy
// يمنع مشاكل CORS ويخفي مفاتيح API

const PAYMENTO_API_KEY = 'MzFCRUEzMTk0MzVCQzRDMDg2N0ZCREFCMzQ5OTc4QzI='; // TODO: Move to Wrangler secret
const PAYMENTO_SECRET_KEY = 'MzE1NERFQjM3MzcyQUREMkEwOEI2ODJGODc4RjFFQzY='; // TODO: Move to Wrangler secret

export default {
  async fetch(request) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      const body = await request.json();
      const { amount, currency, description, success_url, cancel_url, metadata } = body;

      if (!amount || !success_url) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const paymentRes = await fetch('https://api.paymento.io/v1/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${PAYMENTO_API_KEY}`,
          'X-Secret-Key': PAYMENTO_SECRET_KEY,
        },
        body: JSON.stringify({
          amount,
          currency: currency || 'USD',
          description: description || 'Nova VPS subscription',
          success_url,
          cancel_url,
          metadata,
        }),
      });

      const data = await paymentRes.json();

      return new Response(JSON.stringify(data), {
        status: paymentRes.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};
