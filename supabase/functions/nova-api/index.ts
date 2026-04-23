import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://mmvdflwchecvzxzsumlm.supabase.co'
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const ADMIN_SECRET = 'nova-admin-2024-secret'
const PAYMENTO_API_KEY = Deno.env.get('PAYMENTO_API_KEY') || ''
const DISCORD_BOT_TOKEN = Deno.env.get('DISCORD_BOT_TOKEN') || ''

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
    'Content-Type': 'application/json',
  }
}

async function validateToken(req: Request): Promise<{ userId: string; role: string; email: string } | null> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return null
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
  if (token === ADMIN_SECRET) return { userId: 'admin', role: 'admin', email: 'admin@nova.vps' }
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) return null
    const { data: roleData } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', user.id).single()
    return { userId: user.id, role: roleData?.role || 'user', email: user.email || '' }
  } catch { return null }
}

async function requireAuth(req: Request) { const u = await validateToken(req); if (!u) throw new Error('Unauthorized'); return u }
async function requireAdmin(req: Request) { const u = await validateToken(req); if (!u) throw new Error('Unauthorized'); if (u.role !== 'admin') throw new Error('Forbidden'); return u }

async function discordAPI(endpoint: string, method = 'GET', body?: any) {
  if (!DISCORD_BOT_TOKEN) throw new Error('Discord bot token not configured')
  const opts: any = { method, headers: { 'Authorization': `Bot ${DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' } }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(`https://discord.com/api/v10${endpoint}`, opts)
  return { status: res.status, data: await res.json() }
}

async function paymentoAPI(endpoint: string, method = 'GET', body?: any) {
  if (!PAYMENTO_API_KEY) throw new Error('Paymento API key not configured')
  const opts: any = { method, headers: { 'Authorization': `Bearer ${PAYMENTO_API_KEY}`, 'Content-Type': 'application/json' } }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(`https://api.paymento.io${endpoint}`, opts)
  return { status: res.status, data: await res.json() }
}

function j(data: any, status = 200) { return new Response(JSON.stringify(data), { status, headers: getCorsHeaders() }) }

// ============ Ensure Tables Exist ============

async function ensureTables() {
  await supabaseAdmin.rpc('exec_sql', {
    sql_string: `
      CREATE TABLE IF NOT EXISTS bot_processes (
        id TEXT PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES auth.users(id),
        project_id UUID,
        name TEXT NOT NULL DEFAULT 'untitled',
        language TEXT NOT NULL DEFAULT 'javascript',
        status TEXT NOT NULL DEFAULT 'deploying',
        code_size INTEGER,
        logs TEXT[] DEFAULT '{}',
        started_at TIMESTAMPTZ,
        stopped_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      ALTER TABLE bot_processes ENABLE ROW LEVEL SECURITY;
      CREATE OR REPLACE POLICY "Users see own bots" ON bot_processes FOR SELECT USING (user_id = auth.uid());
      CREATE OR REPLACE POLICY "Users insert own bots" ON bot_processes FOR INSERT WITH CHECK (user_id = auth.uid());
      CREATE OR REPLACE POLICY "Users update own bots" ON bot_processes FOR UPDATE USING (user_id = auth.uid());
      CREATE OR REPLACE POLICY "Users delete own bots" ON bot_processes FOR DELETE USING (user_id = auth.uid());
      CREATE OR REPLACE POLICY "Admin full access" ON bot_processes FOR ALL USING (auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin'));

      CREATE TABLE IF NOT EXISTS bot_secrets (
        bot_id TEXT PRIMARY KEY REFERENCES bot_processes(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES auth.users(id),
        token TEXT NOT NULL,
        code TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      ALTER TABLE bot_secrets ENABLE ROW LEVEL SECURITY;
      CREATE OR REPLACE POLICY "Users see own secrets" ON bot_secrets FOR SELECT USING (user_id = auth.uid());
      CREATE OR REPLACE POLICY "Users insert own secrets" ON bot_secrets FOR INSERT WITH CHECK (user_id = auth.uid());
      CREATE OR REPLACE POLICY "Users delete own secrets" ON bot_secrets FOR DELETE USING (user_id = auth.uid());
      CREATE OR REPLACE POLICY "Admin full secrets" ON bot_secrets FOR ALL USING (auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin'));

      CREATE OR REPLACE FUNCTION exec_sql(sql_string TEXT) RETURNS VOID AS $$
      BEGIN EXECUTE sql_string; END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `
  }).catch(() => {})
}

// ============ Route Handlers ============

async function handleHealth() { return j({ status: 'ok', service: 'nova-vps-edge' }) }

async function handleDeploy(req: Request, user: any) {
  const { projectId, language, code, botToken, name } = await req.json()
  if (!projectId || !language || !code || !botToken) return j({ error: 'Missing fields' }, 400)
  if (!['javascript', 'python'].includes(language)) return j({ error: 'Invalid language' }, 400)
  if (botToken.length < 50) return j({ error: 'Invalid token' }, 400)

  const sanitizedName = (name || 'untitled').replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase().slice(0, 30) || 'untitled'
  const serviceName = `bot-${sanitizedName}-${Date.now()}`

  // Upsert bot process
  await supabaseAdmin.from('bot_processes').upsert({
    id: serviceName, user_id: user.userId, project_id: projectId,
    name: sanitizedName, language, status: 'deploying',
    code_size: code.length, started_at: new Date().toISOString(),
  }, { onConflict: 'id' })

  // Store secrets
  await supabaseAdmin.from('bot_secrets').upsert({
    bot_id: serviceName, user_id: user.userId, token: botToken, code,
  }, { onConflict: 'bot_id' })

  // Update project in Supabase
  await supabaseAdmin.from('projects').update({
    status: 'deploying', railway_service_id: serviceName,
  }).eq('id', projectId)

  return j({ success: true, serviceId: serviceName, serviceName })
}

async function handleStop(req: Request, user: any) {
  const { serviceId } = await req.json()
  if (!serviceId) return j({ error: 'Missing serviceId' }, 400)

  await supabaseAdmin.from('bot_processes').update({
    status: 'stopped', stopped_at: new Date().toISOString(),
  }).eq('id', serviceId).eq('user_id', user.userId)

  await supabaseAdmin.from('bot_secrets').delete().eq('bot_id', serviceId).eq('user_id', user.userId)

  return j({ success: true })
}

async function handleStatus(req: Request) {
  const serviceId = new URL(req.url).searchParams.get('serviceId')
  if (!serviceId) return j({ error: 'Missing serviceId' }, 400)

  const { data: bot } = await supabaseAdmin.from('bot_processes').select('status, started_at, stopped_at, logs').eq('id', serviceId).single()
  if (!bot) return j({ status: 'DELETED', message: 'Bot not found' })

  const statusMap: Record<string, string> = {
    deploying: 'DEPLOYING', running: 'SUCCESS', stopped: 'DELETED', error: 'CRASHED', crashed: 'CRASHED',
  }
  return j({ status: statusMap[bot.status] || 'INITIALIZING', logs: bot.logs || [], startedAt: bot.started_at })
}

async function handlePayment(req: Request, user: any) {
  const { amount, currency, description, success_url, metadata } = await req.json()
  if (!amount || !currency || !success_url) return j({ error: 'Missing fields' }, 400)

  if (metadata?.planId) {
    const { data: plan } = await supabaseAdmin.from('plans').select('price').eq('id', metadata.planId).single()
    if (plan && plan.price !== amount) return j({ error: 'Price mismatch' }, 400)
  }

  try {
    const u = new URL(success_url)
    if (!['nova-store.dev', 'localhost'].includes(u.hostname)) return j({ error: 'Invalid URL' }, 400)
  } catch { return j({ error: 'Invalid URL' }, 400) }

  const paymentRes = await paymentoAPI('/v1/payments', 'POST', {
    amount, currency: currency.toLowerCase(), description, 'return_url': success_url, metadata: { ...metadata, userId: user.userId },
  })

  if (paymentRes.status > 201) return j({ error: 'Payment failed', details: paymentRes.data }, 500)

  const token = paymentRes.data?.token || paymentRes.data?.id
  return j({ success: true, url: `https://checkout.paymento.io/${token}`, token, paymentId: token })
}

async function handleVerify(req: Request, user: any) {
  const { token } = await req.json()
  if (!token) return j({ error: 'Missing token' }, 400)

  const { data: payment } = await paymentoAPI(`/v1/payments/${token}`)
  if ([7, 8].includes(payment?.status)) return j({ verified: true, status: 'completed' })
  return j({ verified: false, status: 'pending' })
}

async function handleDiscordCheck(req: Request) {
  const username = new URL(req.url).searchParams.get('username')
  if (!username) return j({ error: 'Missing username' }, 400)

  const res = await fetch(`https://discord.com/api/v10/users/${username}`)
  return j({ available: res.status === 404 })
}

async function handleBotInfo() {
  const { data } = await discordAPI('/users/@me')
  return j({ ...data, inviteUrl: `https://discord.com/oauth2/authorize?client_id=${data.id}&permissions=8&scope=bot%20applications.commands` })
}

async function handleBotInvite() {
  const { data } = await discordAPI('/users/@me')
  return j({ inviteUrl: `https://discord.com/oauth2/authorize?client_id=${data.id}&permissions=8&scope=bot%20applications.commands` })
}

async function handleGuildChannels(req: Request) {
  const guildId = new URL(req.url).pathname.split('/').pop()
  const { data } = await discordAPI(`/guilds/${guildId}/channels`)
  return j((data || []).filter((c: any) => c.type === 0))
}

async function handleRegisterCommands() {
  const { data: appInfo } = await discordAPI('/users/@me')
  const appId = appInfo.id
  const guildId = Deno.env.get('GUILD_ID') || '1492282157601657006'
  const roleId = Deno.env.get('ALLOWED_ROLE_ID') || '1492495751438401577'

  const commands = [
    { name: 'help', description: 'عرض قائمة الأوامر' },
    { name: 'prices', description: 'عرض أسعار الباقات' },
    { name: 'serverinfo', description: 'معلومات السيرفر' },
    { name: 'user', description: 'معلومات عنك', options: [{ name: 'user', description: 'المستخدم', type: 6, required: false }] },
    { name: 'avatar', description: 'صورة حسابك', options: [{ name: 'user', description: 'المستخدم', type: 6, required: false }] },
    { name: 'stats', description: 'إحصائيات المنصة' },
    { name: 'ping', description: 'فحص سرعة البوت' },
    { name: 'invite', description: 'رابط دعوة البوت' },
    { name: 'poll', description: 'إنشاء تصويت', options: [{ name: 'question', description: 'السؤال', type: 3, required: true }] },
    { name: 'announce', description: 'إرسال إعلان', options: [{ name: 'message', description: 'الرسالة', type: 3, required: true }] },
    { name: 'status', description: 'حالة المنصة' },
    { name: 'uptime', description: 'مدة تشغيل البوت' },
    { name: 'roles', description: 'قائمة الرتب' },
    { name: 'banner', description: 'بنر السيرفر' },
    { name: 'lookup', description: 'البحث عن مستخدم', options: [{ name: 'user', description: 'المستخدم', type: 3, required: true }] },
  ]

  await discordAPI(`/applications/${appId}/commands`, 'PUT', [])
  const { data: registered } = await discordAPI(`/applications/${appId}/guilds/${guildId}/commands`, 'PUT', commands)

  for (const cmd of registered || []) {
    await discordAPI(`/applications/${appId}/guilds/${guildId}/commands/${cmd.id}/permissions`, 'PUT', {
      permissions: [{ id: roleId, type: 1, permission: true }, { id: appId, type: 1, permission: true }],
    })
  }

  return j({ success: true, commandsRegistered: commands.length })
}

async function handleSendPrices(req: Request) {
  const { channel_id } = await req.json()
  const { data: plans } = await supabaseAdmin.from('plans').select('*').order('sort_order')

  await discordAPI(`/channels/${channel_id}/messages`, 'POST', {
    embeds: [{
      title: '💡 باقات Nova VPS', color: 0x002b86,
      fields: (plans || []).map((p: any) => ({ name: `${p.name} — $${p.price}`, value: p.description || `مشروع: ${p.max_projects || '∞'} | تخزين: ${p.storage_mb || '∞'}MB`, inline: false })),
      footer: { text: 'Nova VPS — استضافة بوتات ديسكورد' }, timestamp: new Date().toISOString(),
    }],
  })
  return j({ success: true })
}

async function handleAnnounce(req: Request) {
  const { channel_id, message } = await req.json()
  await discordAPI(`/channels/${channel_id}/messages`, 'POST', {
    embeds: [{ title: '📢 إعلان', description: message, color: 0x002b86, timestamp: new Date().toISOString() }],
  })
  return j({ success: true })
}

async function handleSendTicketPanel(req: Request) {
  const { channel_id } = await req.json()
  await discordAPI(`/channels/${channel_id}/messages`, 'POST', {
    embeds: [{ title: '🎫 فتح تذكرة', description: 'اضغط على الزر لفتح تذكرة دعم جديدة', color: 0x002b86 }],
    components: [{ type: 1, components: [{ type: 2, style: 1, label: '🎫 فتح تذكرة', custom_id: 'create_ticket' }] }],
  })
  return j({ success: true })
}

async function handleBotStats() {
  const { count: users } = await supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true })
  const { count: projects } = await supabaseAdmin.from('projects').select('*', { count: 'exact', head: true })
  const { count: subs } = await supabaseAdmin.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active')
  return j({ users: users || 0, projects: projects || 0, subscriptions: subs || 0, runningBots: 0 })
}

async function handleBotSetup() {
  const { data: appInfo } = await discordAPI('/users/@me')
  const publicUrl = Deno.env.get('PUBLIC_URL') || 'https://mmvdflwchecvzxzsumlm.supabase.co'
  await discordAPI(`/applications/${appInfo.id}/interactions-endpoint-url`, 'PATCH', {
    url: `${publicUrl}/functions/v1/nova-api/bot/interactions`,
  })
  return j({ success: true })
}

async function handleBotInteractions(req: Request) {
  const body = await req.json()
  if (body.type === 1) return j({ type: 1 })

  const cmd = body.data?.name
  let resp: any = { type: 4, data: { content: 'تم ✅' } }

  if (cmd === 'prices') {
    const { data: plans } = await supabaseAdmin.from('plans').select('*').order('sort_order')
    resp = { type: 4, data: { embeds: [{ title: '💡 باقات Nova VPS', color: 0x002b86, fields: (plans || []).map((p: any) => ({ name: `${p.name} — $${p.price}`, value: p.description || '-', inline: false })) }] } }
  } else if (cmd === 'stats') {
    const { count: users } = await supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true })
    const { count: projects } = await supabaseAdmin.from('projects').select('*', { count: 'exact', head: true })
    resp = { type: 4, data: { embeds: [{ title: '📊 إحصائيات Nova VPS', color: 0x002b86, fields: [{ name: '👥 المستخدمين', value: `${users || 0}`, inline: true }, { name: '🤖 المشاريع', value: `${projects || 0}`, inline: true }] }] } }
  } else if (cmd === 'serverinfo') {
    const { data: guild } = await discordAPI(`/guilds/${body.data.guild_id}?with_counts=true`)
    resp = { type: 4, data: { embeds: [{ title: `ℹ️ ${guild.name}`, color: 0x002b86, fields: [{ name: '👥 الأعضاء', value: `${guild.approximate_member_count}`, inline: true }, { name: '🟢 المتصلين', value: `${guild.approximate_presence_count}`, inline: true }] }] } }
  } else if (cmd === 'announce') {
    const msg = body.data.options?.find((o: any) => o.name === 'message')?.value
    resp = { type: 4, data: { content: msg ? `📢 **إعلان:** ${msg}` : '❌ اكتب رسالة', flags: msg ? 0 : 64 } }
  } else if (cmd === 'status') {
    resp = { type: 4, data: { embeds: [{ title: '🟢 حالة المنصة', description: 'جميع الأنظمة تعمل ✅', color: 0x00ff00 }] } }
  } else {
    resp = { type: 4, data: { content: 'هذا الأمر غير متاح حالياً.' } }
  }

  return j(resp)
}

async function handleToolPurchaseCheck(req: Request, user: any) {
  const productId = new URL(req.url).pathname.split('/').pop()
  const { data } = await supabaseAdmin.from('tool_purchases').select('id').eq('user_id', user.userId).eq('product_id', productId).eq('status', 'completed')
  return j({ purchased: (data || []).length > 0 })
}

async function handleToolPurchase(req: Request, user: any) {
  const productId = new URL(req.url).pathname.split('/').pop()
  const { data } = await supabaseAdmin.from('tool_purchases').insert({ user_id: user.userId, product_id: productId, status: 'completed', amount: 0.99, currency: 'USD' }).select().single()
  return j({ success: true, purchase: data })
}

async function handleCleanup() {
  const { data } = await supabaseAdmin.from('bot_processes').delete().neq('id', '00000').select()
  await supabaseAdmin.from('bot_secrets').delete().neq('bot_id', '00000')
  return j({ success: true, deleted: (data || []).length })
}

// ============ Main Router ============

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders() })

  const path = new URL(req.url).pathname
  const method = req.method

  // Ensure tables on first request
  await ensureTables()

  try {
    if (path === '/' || path === '/health') return handleHealth()
    if (path.endsWith('/bot/interactions') && method === 'POST') return handleBotInteractions(req)
    if (path.endsWith('/bot/stats') && method === 'GET') { const u = await requireAuth(req); return handleBotStats() }
    if (path.endsWith('/deploy') && method === 'POST') { const u = await requireAuth(req); return handleDeploy(req, u) }
    if (path.endsWith('/stop') && method === 'POST') { const u = await requireAuth(req); return handleStop(req, u) }
    if (path.endsWith('/status') && method === 'GET') return handleStatus(req)
    if (path.endsWith('/payment') && method === 'POST') { const u = await requireAuth(req); return handlePayment(req, u) }
    if (path.endsWith('/verify') && method === 'POST') { const u = await requireAuth(req); return handleVerify(req, u) }
    if (path.endsWith('/discord-check') && method === 'GET') { const u = await requireAuth(req); return handleDiscordCheck(req) }
    if (path.match(/\/tool\/purchase\/[^/]+$/) && method === 'GET') { const u = await requireAuth(req); return handleToolPurchaseCheck(req, u) }
    if (path.match(/\/tool\/purchase\/[^/]+$/) && method === 'POST') { const u = await requireAuth(req); return handleToolPurchase(req, u) }

    // Admin
    if (path.endsWith('/bot/info') && method === 'GET') { await requireAdmin(req); return handleBotInfo() }
    if (path.endsWith('/bot/invite') && method === 'GET') { await requireAdmin(req); return handleBotInvite() }
    if (path.match(/\/bot\/guilds\/[^/]+\/channels$/) && method === 'GET') { await requireAdmin(req); return handleGuildChannels(req) }
    if (path.endsWith('/bot/commands/register') && method === 'POST') { await requireAdmin(req); return handleRegisterCommands() }
    if (path.endsWith('/bot/send-prices') && method === 'POST') { await requireAdmin(req); return handleSendPrices(req) }
    if (path.endsWith('/bot/announce') && method === 'POST') { await requireAdmin(req); return handleAnnounce(req) }
    if (path.endsWith('/bot/send-ticket-panel') && method === 'POST') { await requireAdmin(req); return handleSendTicketPanel(req) }
    if (path.endsWith('/bot/setup') && method === 'POST') { await requireAdmin(req); return handleBotSetup() }
    if (path.endsWith('/cleanup-bots') && method === 'POST') { await requireAdmin(req); return handleCleanup() }

    return j({ error: 'Not found' }, 404)
  } catch (e: any) {
    const status = e.message === 'Unauthorized' ? 401 : e.message === 'Forbidden' ? 403 : 500
    return j({ error: e.message }, status)
  }
})
