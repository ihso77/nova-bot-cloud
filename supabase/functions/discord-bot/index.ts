import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DISCORD_API = 'https://discord.com/api/v10';

const COMMANDS = [
  { name: 'prices', description: 'إرسال رسالة الأسعار والباقات', default_member_permissions: '8',
    options: [{ name: 'channel', description: 'الروم المراد إرسال الأسعار فيه', type: 7, required: false }] },
  { name: 'serverinfo', description: 'عرض معلومات السيرفر', default_member_permissions: '8' },
  { name: 'stats', description: 'عرض إحصائيات Nova VPS', default_member_permissions: '8' },
  { name: 'announce', description: 'إرسال إعلان في روم محدد', default_member_permissions: '8',
    options: [
      { name: 'message', description: 'نص الإعلان', type: 3, required: true },
      { name: 'channel', description: 'الروم', type: 7, required: false },
    ] },
  { name: 'status', description: 'عرض حالة الخدمة' },
  { name: 'ping', description: 'فحص سرعة البوت' },
  { name: 'invite', description: 'رابط دعوة البوت' },
  { name: 'help', description: 'عرض جميع الأوامر المتاحة' },
  { name: 'user', description: 'عرض معلومات مستخدم', options: [{ name: 'member', description: 'المستخدم', type: 6, required: true }] },
  { name: 'avatar', description: 'عرض صورة بروفايل مستخدم', options: [{ name: 'member', description: 'المستخدم', type: 6, required: false }] },
  { name: 'uptime', description: 'مدة تشغيل البوت' },
  { name: 'roles', description: 'عرض قائمة الرتب في السيرفر' },
  { name: 'poll', description: 'إنشاء تصويت', default_member_permissions: '8',
    options: [
      { name: 'question', description: 'السؤال', type: 3, required: true },
      { name: 'channel', description: 'الروم', type: 7, required: false },
    ] },
  { name: 'site-check', description: 'فحص حالة خدمات الموقع' },
  { name: 'plans-detail', description: 'عرض تفاصيل الباقات والمقارنة' },
  { name: 'lookup', description: 'بحث عن مستخدم بالبريد (أدمن)', default_member_permissions: '8',
    options: [{ name: 'email', description: 'البريد الإلكتروني', type: 3, required: true }] },
  { name: 'recent-payments', description: 'عرض آخر المدفوعات (أدمن)', default_member_permissions: '8' },
];

async function discordRequest(endpoint: string, options: RequestInit, botToken: string) {
  const res = await fetch(`${DISCORD_API}${endpoint}`, {
    ...options,
    headers: { 'Authorization': `Bot ${botToken}`, 'Content-Type': 'application/json', ...options.headers },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord API error ${res.status}: ${text}`);
  }
  return res.json();
}

async function getPlansEmbed(supabaseClient: any) {
  const { data: plans } = await supabaseClient.from('plans').select('*').eq('is_active', true).order('sort_order');
  const fields = (plans || []).map((p: any) => ({
    name: `${p.is_free ? '🎁' : '⭐'} ${p.name}`,
    value: [
      `💰 ${p.price === 0 ? '**مجاني**' : `**$${p.price}/شهر**`}`,
      `💾 ${p.storage_mb >= 1024 ? `${p.storage_mb / 1024}GB` : `${p.storage_mb}MB`}`,
      `🧠 ${p.ram_mb >= 1024 ? `${p.ram_mb / 1024}GB` : `${p.ram_mb}MB`}`,
      `⚡ ${p.cpu_cores} نواة`,
      p.description ? `📋 ${p.description}` : '',
    ].filter(Boolean).join('\n'),
    inline: true,
  }));
  return { embeds: [{ title: '🚀 Nova VPS - باقات الاستضافة', description: '🔗 **[اشترك الآن](https://novavps.app/plans)**', color: 0x8B5CF6, fields, footer: { text: 'Nova VPS' }, timestamp: new Date().toISOString() }] };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const BOT_TOKEN = Deno.env.get('DISCORD_BOT_TOKEN');
    if (!BOT_TOKEN) return new Response(JSON.stringify({ error: 'Discord bot token not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const body = await req.json();
    const { action } = body;

    if (action === 'register_commands') {
      const me = await discordRequest('/users/@me', { method: 'GET' }, BOT_TOKEN);
      const result = await discordRequest(`/applications/${me.id}/commands`, { method: 'PUT', body: JSON.stringify(COMMANDS) }, BOT_TOKEN);
      return new Response(JSON.stringify({ success: true, message: `تم تسجيل ${result.length} أمر بنجاح`, commands: result.map((c: any) => c.name) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'send_prices') {
      const { channel_id } = body;
      if (!channel_id) return new Response(JSON.stringify({ error: 'channel_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const embed = await getPlansEmbed(supabaseClient);
      await discordRequest(`/channels/${channel_id}/messages`, { method: 'POST', body: JSON.stringify(embed) }, BOT_TOKEN);
      return new Response(JSON.stringify({ success: true, message: 'تم إرسال الأسعار' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'send_announcement') {
      const { channel_id, message } = body;
      if (!channel_id || !message) return new Response(JSON.stringify({ error: 'channel_id and message required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      await discordRequest(`/channels/${channel_id}/messages`, { method: 'POST', body: JSON.stringify({ embeds: [{ title: '📢 إعلان من Nova VPS', description: message, color: 0x8B5CF6, footer: { text: 'Nova VPS' }, timestamp: new Date().toISOString() }] }) }, BOT_TOKEN);
      return new Response(JSON.stringify({ success: true, message: 'تم إرسال الإعلان' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'bot_info') {
      const me = await discordRequest('/users/@me', { method: 'GET' }, BOT_TOKEN);
      const guilds = await discordRequest('/users/@me/guilds', { method: 'GET' }, BOT_TOKEN);
      return new Response(JSON.stringify({ bot: { id: me.id, username: me.username, discriminator: me.discriminator, avatar: me.avatar }, guilds_count: guilds.length, guilds: guilds.map((g: any) => ({ id: g.id, name: g.name, icon: g.icon })) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'get_channels') {
      const { guild_id } = body;
      if (!guild_id) return new Response(JSON.stringify({ error: 'guild_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const channels = await discordRequest(`/guilds/${guild_id}/channels`, { method: 'GET' }, BOT_TOKEN);
      const textChannels = channels.filter((c: any) => c.type === 0);
      return new Response(JSON.stringify({ channels: textChannels.map((c: any) => ({ id: c.id, name: c.name })) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'get_stats') {
      const [usersRes, projectsRes, subsRes] = await Promise.all([
        supabaseClient.from('profiles').select('id', { count: 'exact', head: true }),
        supabaseClient.from('projects').select('id', { count: 'exact', head: true }),
        supabaseClient.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      ]);
      return new Response(JSON.stringify({ users: usersRes.count || 0, projects: projectsRes.count || 0, active_subscriptions: subsRes.count || 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: unknown) {
    console.error('Discord bot error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
