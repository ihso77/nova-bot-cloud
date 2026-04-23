import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://mmvdflwchecvzxzsumlm.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tdmRmbHdjaGVjdnp4enN1bWxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NzAxNTIsImV4cCI6MjA5MTM0NjE1Mn0.RSp-IigZGyh9m-oD6MeMcJDPYHFHl-_m2ttqq9fBEd0'
const ADMIN_SECRET = 'nova-admin-2024-secret'
const PAYMENTO_API_KEY = process.env.PAYMENTO_API_KEY || ''
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || ''

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY)
const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

function cors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type')
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS, PUT, DELETE')
}

async function validateToken(authHeader: string | null): Promise<{ userId: string; role: string; email: string } | null> {
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

async function discordAPI(endpoint: string, method = 'GET', body?: any) {
  if (!DISCORD_BOT_TOKEN) throw new Error('Discord bot token not configured')
  const opts: any = { method, headers: { 'Authorization': `Bot ${DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' } }
  if (body) opts.body = JSON.stringify(body)
  const r = await fetch(`https://discord.com/api/v10${endpoint}`, opts)
  return { status: r.status, data: await r.json() }
}

async function paymentoAPI(endpoint: string, method = 'GET', body?: any) {
  if (!PAYMENTO_API_KEY) throw new Error('Paymento not configured')
  const opts: any = { method, headers: { 'Authorization': `Bearer ${PAYMENTO_API_KEY}`, 'Content-Type': 'application/json' } }
  if (body) opts.body = JSON.stringify(body)
  const r = await fetch(`https://api.paymento.io${endpoint}`, opts)
  return { status: r.status, data: await r.json() }
}

async function ensureTables() {
  try {
    await supabaseAdmin.rpc('exec_sql', { sql_string: `
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
      CREATE OR REPLACE POLICY "Admin full access bots" ON bot_processes FOR ALL USING (
        EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
      );
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
      CREATE OR REPLACE POLICY "Admin full secrets" ON bot_secrets FOR ALL USING (
        EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
      );
    ` }).catch(() => {})
  } catch {}
}

function getRoute(req: VercelRequest): string {
  // Vercel serves this file at /api/nova-api-handler
  // Sub-paths like /api/nova-api-handler/deploy come as the full URL
  // We need to extract the path after /api/nova-api-handler
  const fullPath = req.url ? new URL(req.url).pathname : ''
  const prefix = '/api/nova-api-handler'
  if (fullPath === prefix || fullPath === prefix + '/') return '/'
  return fullPath.slice(prefix.length) || '/'
}

// ============ Route Handlers ============

async function handleDeploy(req: VercelRequest, res: VercelResponse, user: any) {
  const { projectId, language, code, botToken, name } = req.body
  if (!projectId || !language || !code || !botToken) return res.status(400).json({ error: 'Missing fields' })
  if (!['javascript', 'python'].includes(language)) return res.status(400).json({ error: 'Invalid language' })
  if (botToken.length < 50) return res.status(400).json({ error: 'Invalid token' })

  const sanitizedName = (name || 'untitled').replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase().slice(0, 30) || 'untitled'
  const serviceName = `bot-${sanitizedName}-${Date.now()}`

  await supabaseAdmin.from('bot_processes').upsert({
    id: serviceName, user_id: user.userId, project_id: projectId,
    name: sanitizedName, language, status: 'deploying',
    code_size: code.length, started_at: new Date().toISOString(),
  }, { onConflict: 'id' }).catch(() => {})

  await supabaseAdmin.from('bot_secrets').upsert({
    bot_id: serviceName, user_id: user.userId, token: botToken, code,
  }, { onConflict: 'bot_id' }).catch(() => {})

  // Update project
  await supabaseAdmin.from('projects').update({
    status: 'deploying', railway_service_id: serviceName,
  }).eq('id', projectId).catch(() => {})

  return res.json({ success: true, serviceId: serviceName, serviceName })
}

async function handleStop(req: VercelRequest, res: VercelResponse, user: any) {
  const { serviceId } = req.body
  if (!serviceId) return res.status(400).json({ error: 'Missing serviceId' })

  await supabaseAdmin.from('bot_processes').update({
    status: 'stopped', stopped_at: new Date().toISOString(),
  }).eq('id', serviceId).eq('user_id', user.userId)

  await supabaseAdmin.from('bot_secrets').delete().eq('bot_id', serviceId).eq('user_id', user.userId)

  return res.json({ success: true })
}

async function handleStatus(req: VercelRequest, res: VercelResponse) {
  const serviceId = req.query.serviceId as string
  if (!serviceId) return res.status(400).json({ error: 'Missing serviceId' })

  const { data: bot } = await supabaseAdmin.from('bot_processes').select('status, started_at, stopped_at, logs').eq('id', serviceId).single()
  if (!bot) return res.json({ status: 'DELETED', message: 'Bot not found' })

  const map: Record<string, string> = { deploying: 'DEPLOYING', running: 'SUCCESS', stopped: 'DELETED', error: 'CRASHED', crashed: 'CRASHED' }
  return res.json({ status: map[bot.status] || 'INITIALIZING', logs: bot.logs || [], startedAt: bot.started_at })
}

async function handlePayment(req: VercelRequest, res: VercelResponse, user: any) {
  const { amount, currency, description, success_url, metadata } = req.body
  if (!amount || !currency || !success_url) return res.status(400).json({ error: 'Missing fields' })

  if (metadata?.planId) {
    const { data: plan } = await supabaseAdmin.from('plans').select('price').eq('id', metadata.planId).single()
    if (plan && plan.price !== amount) return res.status(400).json({ error: 'Price mismatch' })
  }

  try {
    const u = new URL(success_url)
    if (!['nova-store.dev', 'localhost'].includes(u.hostname)) return res.status(400).json({ error: 'Invalid URL' })
  } catch { return res.status(400).json({ error: 'Invalid URL' }) }

  const pr = await paymentoAPI('/v1/payments', 'POST', {
    amount, currency: currency.toLowerCase(), description, 'return_url': success_url, metadata: { ...metadata, userId: user.userId },
  })
  if (pr.status > 201) return res.status(500).json({ error: 'Payment failed', details: pr.data })

  const token = pr.data?.token || pr.data?.id
  return res.json({ success: true, url: `https://checkout.paymento.io/${token}`, token, paymentId: token })
}

async function handleVerify(req: VercelRequest, res: VercelResponse) {
  const { token } = req.body
  if (!token) return res.status(400).json({ error: 'Missing token' })

  const { data: payment } = await paymentoAPI(`/v1/payments/${token}`)
  if ([7, 8].includes(payment?.status)) return res.json({ verified: true, status: 'completed' })
  return res.json({ verified: false, status: 'pending' })
}

async function handleDiscordCheck(req: VercelRequest, res: VercelResponse) {
  const username = req.query.username as string
  if (!username) return res.status(400).json({ error: 'Missing username' })

  if (!DISCORD_BOT_TOKEN) return res.status(503).json({ error: 'Discord not configured' })
  const r = await fetch(`https://discord.com/api/v10/users/${username}`)
  return res.json({ available: r.status === 404 })
}

async function handleBotInfo(res: VercelResponse) {
  const { data } = await discordAPI('/users/@me')
  return res.json({ ...data, inviteUrl: `https://discord.com/oauth2/authorize?client_id=${data.id}&permissions=8&scope=bot%20applications.commands` })
}

async function handleBotInvite(res: VercelResponse) {
  const { data } = await discordAPI('/users/@me')
  return res.json({ inviteUrl: `https://discord.com/oauth2/authorize?client_id=${data.id}&permissions=8&scope=bot%20applications.commands` })
}

async function handleGuildChannels(req: VercelRequest, res: VercelResponse) {
  const slug = req.query.slug as string[]
  const guildId = slug[slug.length - 1]
  const { data } = await discordAPI(`/guilds/${guildId}/channels`)
  return res.json((data || []).filter((c: any) => c.type === 0))
}

async function handleRegisterCommands(res: VercelResponse) {
  const { data: appInfo } = await discordAPI('/users/@me')
  const appId = appInfo.id
  const guildId = process.env.GUILD_ID || '1492282157601657006'
  const roleId = process.env.ALLOWED_ROLE_ID || '1492495751438401577'

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
  return res.json({ success: true, commandsRegistered: commands.length })
}

async function handleSendPrices(req: VercelRequest, res: VercelResponse) {
  const { channel_id } = req.body
  const { data: plans } = await supabaseAdmin.from('plans').select('*').order('sort_order')
  await discordAPI(`/channels/${channel_id}/messages`, 'POST', {
    embeds: [{
      title: '💡 باقات Nova VPS', color: 0x002b86,
      fields: (plans || []).map((p: any) => ({ name: `${p.name} — $${p.price}`, value: p.description || '-', inline: false })),
      footer: { text: 'Nova VPS — استضافة بوتات ديسكورد' }, timestamp: new Date().toISOString(),
    }],
  })
  return res.json({ success: true })
}

async function handleAnnounce(req: VercelRequest, res: VercelResponse) {
  const { channel_id, message } = req.body
  await discordAPI(`/channels/${channel_id}/messages`, 'POST', {
    embeds: [{ title: '📢 إعلان', description: message, color: 0x002b86, timestamp: new Date().toISOString() }],
  })
  return res.json({ success: true })
}

async function handleSendTicketPanel(req: VercelRequest, res: VercelResponse) {
  const { channel_id } = req.body
  await discordAPI(`/channels/${channel_id}/messages`, 'POST', {
    embeds: [{ title: '🎫 فتح تذكرة', description: 'اضغط على الزر لفتح تذكرة دعم جديدة', color: 0x002b86 }],
    components: [{ type: 1, components: [{ type: 2, style: 1, label: '🎫 فتح تذكرة', custom_id: 'create_ticket' }] }],
  })
  return res.json({ success: true })
}

async function handleBotStats(res: VercelResponse) {
  const { count: users } = await supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true })
  const { count: projects } = await supabaseAdmin.from('projects').select('*', { count: 'exact', head: true })
  const { count: subs } = await supabaseAdmin.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active')
  return res.json({ users: users || 0, projects: projects || 0, subscriptions: subs || 0, runningBots: 0 })
}

async function handleBotSetup(res: VercelResponse) {
  const { data: appInfo } = await discordAPI('/users/@me')
  const publicUrl = process.env.PUBLIC_URL || 'https://nova-store.dev'
  await discordAPI(`/applications/${appInfo.id}/interactions-endpoint-url`, 'PATCH', {
    url: `${publicUrl}/api/nova-api/bot/interactions`,
  })
  return res.json({ success: true })
}

async function handleBotInteractions(req: VercelRequest, res: VercelResponse) {
  const body = req.body
  if (body.type === 1) return res.json({ type: 1 })

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
  return res.json(resp)
}

async function handleToolCheck(req: VercelRequest, res: VercelResponse, user: any) {
  const slug = req.query.slug as string[]
  const productId = slug[slug.length - 1]
  const { data } = await supabaseAdmin.from('tool_purchases').select('id').eq('user_id', user.userId).eq('product_id', productId).eq('status', 'completed')
  return res.json({ purchased: (data || []).length > 0 })
}

async function handleToolPurchase(req: VercelRequest, res: VercelResponse, user: any) {
  const slug = req.query.slug as string[]
  const productId = slug[slug.length - 1]
  const { data } = await supabaseAdmin.from('tool_purchases').insert({ user_id: user.userId, product_id: productId, status: 'completed', amount: 0.99, currency: 'USD' }).select().single()
  return res.json({ success: true, purchase: data })
}

async function handleCleanup(res: VercelResponse) {
  const { data } = await supabaseAdmin.from('bot_processes').delete().neq('id', '00000').select()
  await supabaseAdmin.from('bot_secrets').delete().neq('bot_id', '00000')
  return res.json({ success: true, deleted: (data || []).length })
}

// ============ Main Handler ============

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  const route = getRoute(req)
  const method = req.method

  await ensureTables()

  try {
    // Health
    if (route === '/' || route === '/health') return res.json({ status: 'ok', service: 'nova-vps-vercel' })

    // Discord webhook (no auth)
    if (route.endsWith('/bot/interactions') && method === 'POST') return handleBotInteractions(req, res)

    // Bot stats (user auth)
    if (route.endsWith('/bot/stats') && method === 'GET') {
      const u = await validateToken(req.headers.authorization); if (!u) return res.status(401).json({ error: 'Unauthorized' })
      return handleBotStats(res)
    }

    // === User auth routes ===
    if (route === '/deploy' && method === 'POST') {
      const u = await validateToken(req.headers.authorization); if (!u) return res.status(401).json({ error: 'Unauthorized' })
      return handleDeploy(req, res, u)
    }
    if (route === '/stop' && method === 'POST') {
      const u = await validateToken(req.headers.authorization); if (!u) return res.status(401).json({ error: 'Unauthorized' })
      return handleStop(req, res, u)
    }
    if (route === '/status' && method === 'GET') return handleStatus(req, res)
    if (route === '/payment' && method === 'POST') {
      const u = await validateToken(req.headers.authorization); if (!u) return res.status(401).json({ error: 'Unauthorized' })
      return handlePayment(req, res, u)
    }
    if (route === '/verify' && method === 'POST') {
      const u = await validateToken(req.headers.authorization); if (!u) return res.status(401).json({ error: 'Unauthorized' })
      return handleVerify(req, res)
    }
    if (route === '/discord-check' && method === 'GET') {
      const u = await validateToken(req.headers.authorization); if (!u) return res.status(401).json({ error: 'Unauthorized' })
      return handleDiscordCheck(req, res)
    }
    if (route.match(/\/tool\/purchase\/[^/]+$/) && method === 'GET') {
      const u = await validateToken(req.headers.authorization); if (!u) return res.status(401).json({ error: 'Unauthorized' })
      return handleToolCheck(req, res, u)
    }
    if (route.match(/\/tool\/purchase\/[^/]+$/) && method === 'POST') {
      const u = await validateToken(req.headers.authorization); if (!u) return res.status(401).json({ error: 'Unauthorized' })
      return handleToolPurchase(req, res, u)
    }

    // === Admin routes ===
    if (route === '/bot/info' && method === 'GET') {
      const u = await validateToken(req.headers.authorization); if (!u || u.role !== 'admin') return u ? res.status(403).json({ error: 'Forbidden' }) : res.status(401).json({ error: 'Unauthorized' })
      return handleBotInfo(res)
    }
    if (route === '/bot/invite' && method === 'GET') {
      const u = await validateToken(req.headers.authorization); if (!u || u.role !== 'admin') return u ? res.status(403).json({ error: 'Forbidden' }) : res.status(401).json({ error: 'Unauthorized' })
      return handleBotInvite(res)
    }
    if (route.match(/\/bot\/guilds\/[^/]+\/channels$/) && method === 'GET') {
      const u = await validateToken(req.headers.authorization); if (!u || u.role !== 'admin') return u ? res.status(403).json({ error: 'Forbidden' }) : res.status(401).json({ error: 'Unauthorized' })
      return handleGuildChannels(req, res)
    }
    if (route === '/bot/commands/register' && method === 'POST') {
      const u = await validateToken(req.headers.authorization); if (!u || u.role !== 'admin') return u ? res.status(403).json({ error: 'Forbidden' }) : res.status(401).json({ error: 'Unauthorized' })
      return handleRegisterCommands(res)
    }
    if (route === '/bot/send-prices' && method === 'POST') {
      const u = await validateToken(req.headers.authorization); if (!u || u.role !== 'admin') return u ? res.status(403).json({ error: 'Forbidden' }) : res.status(401).json({ error: 'Unauthorized' })
      return handleSendPrices(req, res)
    }
    if (route === '/bot/announce' && method === 'POST') {
      const u = await validateToken(req.headers.authorization); if (!u || u.role !== 'admin') return u ? res.status(403).json({ error: 'Forbidden' }) : res.status(401).json({ error: 'Unauthorized' })
      return handleAnnounce(req, res)
    }
    if (route === '/bot/send-ticket-panel' && method === 'POST') {
      const u = await validateToken(req.headers.authorization); if (!u || u.role !== 'admin') return u ? res.status(403).json({ error: 'Forbidden' }) : res.status(401).json({ error: 'Unauthorized' })
      return handleSendTicketPanel(req, res)
    }
    if (route === '/bot/setup' && method === 'POST') {
      const u = await validateToken(req.headers.authorization); if (!u || u.role !== 'admin') return u ? res.status(403).json({ error: 'Forbidden' }) : res.status(401).json({ error: 'Unauthorized' })
      return handleBotSetup(res)
    }
    if (route === '/cleanup-bots' && method === 'POST') {
      const u = await validateToken(req.headers.authorization); if (!u || u.role !== 'admin') return u ? res.status(403).json({ error: 'Forbidden' }) : res.status(401).json({ error: 'Unauthorized' })
      return handleCleanup(res)
    }

    return res.status(404).json({ error: 'Not found', route })
  } catch (e: any) {
    const status = e.message === 'Unauthorized' ? 401 : e.message === 'Forbidden' ? 403 : 500
    return res.status(status).json({ error: e.message })
  }
}
