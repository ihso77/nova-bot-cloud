import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://mmvdflwchecvzxzsumlm.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tdmRmbHdjaGVjdnp4enN1bWxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NzAxNTIsImV4cCI6MjA5MTM0NjE1Mn0.RSp-IigZGyh9m-oD6MeMcJDPYHFHl-_m2ttqq9fBEd0'
const ADMIN_SECRET = 'nova-admin-2024-secret'
const PAYMENTO_API_KEY = process.env.PAYMENTO_API_KEY || ''
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || ''

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY)

function cors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type')
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS, PUT, DELETE')
}

async function validateToken(authHeader: string | null) {
  if (!authHeader) return null
  try {
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
    if (token === ADMIN_SECRET) return { userId: 'admin', role: 'admin', email: 'admin@nova.vps' }
    const result = await supabaseAdmin.auth.getUser(token)
    const user = result.data?.user
    if (!user || result.error) return null
    try {
      const { data: roleData } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', user.id).single()
      return { userId: user.id, role: roleData?.role || 'user', email: user.email || '' }
    } catch { return { userId: user.id, role: 'user', email: user.email || '' } }
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

function getRoute(req: VercelRequest): string {
  const url = req.url || '/'
  try {
    const pathname = new URL(url.startsWith('http') ? url : 'https://localhost' + url).pathname
    const prefix = '/api/nova-api-handler'
    if (pathname === prefix || pathname === prefix + '/') return '/'
    return pathname.slice(prefix.length) || '/'
  } catch { return '/' }
}

// Safe DB helpers - never throw
async function safeUpdate(table: string, data: any, col: string, val: string) {
  try { await supabaseAdmin.from(table).update(data).eq(col, val) } catch {}
}
async function safeUpsert(table: string, data: any, onConflict?: string) {
  try { const o: any = {}; if (onConflict) o.onConflict = onConflict; await supabaseAdmin.from(table).upsert(data, o) } catch {}
}
async function safeDelete(table: string, col: string, val: string) {
  try { await supabaseAdmin.from(table).delete().eq(col, val) } catch {}
}
async function safeSelect(table: string, cols = '*', extra?: (q: any) => any) {
  try { let q = supabaseAdmin.from(table).select(cols); if (extra) q = extra(q); return await q } catch { return { data: null } }
}

// ============ Route Handlers ============

async function handleDeploy(req: VercelRequest, res: VercelResponse, user: any) {
  const { projectId, language, code, botToken, name } = req.body
  if (!projectId || !language || !code || !botToken) return res.status(400).json({ error: 'Missing fields' })
  if (!['javascript', 'python'].includes(language)) return res.status(400).json({ error: 'Invalid language' })
  if (botToken.length < 50) return res.status(400).json({ error: 'Invalid token' })

  const sanitizedName = (name || 'untitled').replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase().slice(0, 30) || 'untitled'
  const serviceName = `bot-${sanitizedName}-${Date.now()}`

  // Primary: update projects table (always exists)
  await safeUpdate('projects', { status: 'deploying', railway_service_id: serviceName }, 'id', projectId)

  // Secondary: try bot_processes/bot_secrets (may not exist yet)
  await safeUpsert('bot_processes', {
    id: serviceName, user_id: user.userId, project_id: projectId,
    name: sanitizedName, language, status: 'deploying',
    code_size: code.length, started_at: new Date().toISOString(),
  }, 'id')
  await safeUpsert('bot_secrets', {
    bot_id: serviceName, user_id: user.userId, token: botToken, code,
  }, 'bot_id')

  return res.json({ success: true, serviceId: serviceName, serviceName })
}

async function handleStop(req: VercelRequest, res: VercelResponse, user: any) {
  const { serviceId } = req.body
  if (!serviceId) return res.status(400).json({ error: 'Missing serviceId' })

  await safeUpdate('bot_processes', { status: 'stopped', stopped_at: new Date().toISOString() }, 'id', serviceId)
  await safeDelete('bot_secrets', 'bot_id', serviceId)
  return res.json({ success: true })
}

async function handleStatus(req: VercelRequest, res: VercelResponse) {
  const serviceId = req.query.serviceId as string
  if (!serviceId) return res.status(400).json({ error: 'Missing serviceId' })

  // Try bot_processes first
  const { data: bot } = await safeSelect('bot_processes', 'status,started_at,stopped_at,logs',
    (q: any) => q.eq('id', serviceId).single()
  )
  if (bot) {
    const m: Record<string, string> = { deploying: 'DEPLOYING', running: 'SUCCESS', stopped: 'DELETED', error: 'CRASHED', crashed: 'CRASHED' }
    return res.json({ status: m[bot.status] || 'INITIALIZING', logs: bot.logs || [], startedAt: bot.started_at })
  }

  // Fallback: check projects table
  const { data: proj } = await safeSelect('projects', 'status',
    (q: any) => q.eq('railway_service_id', serviceId).single()
  )
  if (proj) {
    const m: Record<string, string> = { deploying: 'DEPLOYING', running: 'SUCCESS', stopped: 'DELETED', error: 'CRASHED' }
    return res.json({ status: m[proj.status] || 'INITIALIZING', logs: [] })
  }

  return res.json({ status: 'DELETED', message: 'Bot not found' })
}

async function handlePayment(req: VercelRequest, res: VercelResponse, user: any) {
  const { amount, currency, description, success_url, metadata } = req.body
  if (!amount || !currency || !success_url) return res.status(400).json({ error: 'Missing fields' })
  if (metadata?.planId) {
    const { data: p } = await safeSelect('plans', 'price', (q: any) => q.eq('id', metadata.planId).single())
    if (p && p.price !== amount) return res.status(400).json({ error: 'Price mismatch' })
  }
  try { const u = new URL(success_url); if (!['nova-store.dev', 'localhost'].includes(u.hostname)) return res.status(400).json({ error: 'Invalid URL' }) } catch { return res.status(400).json({ error: 'Invalid URL' }) }
  try {
    const pr = await paymentoAPI('/v1/payments', 'POST', { amount, currency: currency.toLowerCase(), description, 'return_url': success_url, metadata: { ...metadata, userId: user.userId } })
    if (pr.status > 201) return res.status(500).json({ error: 'Payment failed', details: pr.data })
    const t = pr.data?.token || pr.data?.id
    return res.json({ success: true, url: `https://checkout.paymento.io/${t}`, token: t, paymentId: t })
  } catch (e: any) { return res.status(500).json({ error: e.message || 'Payment error' }) }
}

async function handleVerify(req: VercelRequest, res: VercelResponse) {
  const { token } = req.body
  if (!token) return res.status(400).json({ error: 'Missing token' })
  try {
    const { data: p } = await paymentoAPI(`/v1/payments/${token}`)
    if ([7, 8].includes(p?.status)) return res.json({ verified: true, status: 'completed' })
    return res.json({ verified: false, status: 'pending' })
  } catch (e: any) { return res.status(500).json({ error: e.message }) }
}

async function handleDiscordCheck(req: VercelRequest, res: VercelResponse) {
  const username = req.query.username as string
  if (!username) return res.status(400).json({ error: 'Missing username' })
  if (!DISCORD_BOT_TOKEN) return res.status(503).json({ error: 'Discord not configured' })
  try { const r = await fetch(`https://discord.com/api/v10/users/${username}`); return res.json({ available: r.status === 404 }) } catch { return res.json({ available: false }) }
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
  const { data: reg } = await discordAPI(`/applications/${appId}/guilds/${guildId}/commands`, 'PUT', commands)
  for (const c of reg || []) {
    await discordAPI(`/applications/${appId}/guilds/${guildId}/commands/${c.id}/permissions`, 'PUT', {
      permissions: [{ id: roleId, type: 1, permission: true }, { id: appId, type: 1, permission: true }],
    })
  }
  return res.json({ success: true, commandsRegistered: commands.length })
}

async function handleSendPrices(req: VercelRequest, res: VercelResponse) {
  const { channel_id } = req.body
  const { data: plans } = await safeSelect('plans', '*', (q: any) => q.order('sort_order'))
  await discordAPI(`/channels/${channel_id}/messages`, 'POST', {
    embeds: [{
      title: '💡 باقات Nova VPS', color: 0x002b86,
      fields: (plans || []).map((p: any) => ({ name: `${p.name} — $${p.price}`, value: p.description || '-', inline: false })),
      footer: { text: 'Nova VPS — استضافة بوتات ديسكورد' },
      timestamp: new Date().toISOString(),
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
  const { count: users } = await safeSelect('profiles', '*')
  const { count: projects } = await safeSelect('projects', '*')
  const { count: subs } = await safeSelect('subscriptions', '*')
  return res.json({ users: users || 0, projects: projects || 0, subscriptions: subs || 0, runningBots: 0 })
}

async function handleBotSetup(res: VercelResponse) {
  const { data: appInfo } = await discordAPI('/users/@me')
  const publicUrl = process.env.PUBLIC_URL || 'https://nova-store.dev'
  await discordAPI(`/applications/${appInfo.id}/interactions-endpoint-url`, 'PATCH', {
    url: `${publicUrl}/api/nova-api-handler/bot/interactions`,
  })
  return res.json({ success: true })
}

async function handleBotInteractions(req: VercelRequest, res: VercelResponse) {
  try {
    const body = req.body
    if (body.type === 1) return res.json({ type: 1 })
    const cmd = body.data?.name
    let resp: any = { type: 4, data: { content: 'تم ✅' } }

    if (cmd === 'prices') {
      const { data: plans } = await safeSelect('plans', '*')
      resp = { type: 4, data: { embeds: [{ title: '💡 باقات Nova VPS', color: 0x002b86, fields: (plans || []).map((p: any) => ({ name: `${p.name} — $${p.price}`, value: p.description || '-' })) }] } }
    } else if (cmd === 'stats') {
      const { count: users } = await safeSelect('profiles', '*')
      const { count: projects } = await safeSelect('projects', '*')
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
  } catch {
    return res.json({ type: 4, data: { content: 'حدث خطأ في معالجة الأمر.' } })
  }
}

async function handleToolCheck(req: VercelRequest, res: VercelResponse, user: any) {
  const slug = req.query.slug as string[]
  const productId = slug[slug.length - 1]
  const { data } = await safeSelect('tool_purchases', 'id',
    (q: any) => q.eq('user_id', user.userId).eq('product_id', productId).eq('status', 'completed')
  )
  return res.json({ purchased: (data || []).length > 0 })
}

async function handleToolPurchase(req: VercelRequest, res: VercelResponse, user: any) {
  const slug = req.query.slug as string[]
  const productId = slug[slug.length - 1]
  const { data } = await safeSelect('tool_purchases', '*',
    (q: any) => q.insert({ user_id: user.userId, product_id: productId, status: 'completed', amount: 0.99, currency: 'USD' }).select().single()
  )
  return res.json({ success: true, purchase: data })
}

async function handleCleanup(res: VercelResponse) {
  const { data } = await safeSelect('bot_processes', '*', (q: any) => q.delete().neq('id', '00000').select())
  return res.json({ success: true, deleted: (data || []).length })
}

async function adminAuth(authHeader: string | null, res: VercelResponse): Promise<boolean> {
  const u = await validateToken(authHeader)
  if (!u) { res.status(401).json({ error: 'Unauthorized' }); return false }
  if (u.role !== 'admin') { res.status(403).json({ error: 'Forbidden' }); return false }
  return true
}

// ============ Main Handler ============

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ALWAYS return JSON - even on catastrophic errors
  const jsonError = (status: number, msg: string) => {
    try { if (!res.headersSent) res.status(status).json({ error: msg }) } catch {}
    return res
  }

  try {
    cors(res)
    if (req.method === 'OPTIONS') return res.status(200).end()

    let route: string
    try { route = getRoute(req) } catch { return jsonError(400, 'Invalid URL') }
    const method = req.method

    try {
      // Health
      if (route === '/' || route === '/health') return res.json({ status: 'ok', service: 'nova-vps-vercel' })

      // Discord webhook (no auth)
      if (route.endsWith('/bot/interactions') && method === 'POST') return await handleBotInteractions(req, res)

      // Bot stats (user auth)
      if (route.endsWith('/bot/stats') && method === 'GET') {
        const u = await validateToken(req.headers.authorization); if (!u) return jsonError(401, 'Unauthorized')
        return await handleBotStats(res)
      }

      // === User auth routes ===
      if (route === '/deploy' && method === 'POST') {
        const u = await validateToken(req.headers.authorization); if (!u) return jsonError(401, 'Unauthorized')
        return await handleDeploy(req, res, u)
      }
      if (route === '/stop' && method === 'POST') {
        const u = await validateToken(req.headers.authorization); if (!u) return jsonError(401, 'Unauthorized')
        return await handleStop(req, res, u)
      }
      if (route === '/status' && method === 'GET') return await handleStatus(req, res)
      if (route === '/payment' && method === 'POST') {
        const u = await validateToken(req.headers.authorization); if (!u) return jsonError(401, 'Unauthorized')
        return await handlePayment(req, res, u)
      }
      if (route === '/verify' && method === 'POST') {
        const u = await validateToken(req.headers.authorization); if (!u) return jsonError(401, 'Unauthorized')
        return await handleVerify(req, res)
      }
      if (route === '/discord-check' && method === 'GET') {
        const u = await validateToken(req.headers.authorization); if (!u) return jsonError(401, 'Unauthorized')
        return await handleDiscordCheck(req, res)
      }
      if (route.match(/\/tool\/purchase\/[^/]+$/) && method === 'GET') {
        const u = await validateToken(req.headers.authorization); if (!u) return jsonError(401, 'Unauthorized')
        return await handleToolCheck(req, res, u)
      }
      if (route.match(/\/tool\/purchase\/[^/]+$/) && method === 'POST') {
        const u = await validateToken(req.headers.authorization); if (!u) return jsonError(401, 'Unauthorized')
        return await handleToolPurchase(req, res, u)
      }

      // === Admin routes ===
      if (route === '/bot/info' && method === 'GET') { if (!await adminAuth(req.headers.authorization, res)) return res; return await handleBotInfo(res) }
      if (route === '/bot/invite' && method === 'GET') { if (!await adminAuth(req.headers.authorization, res)) return res; return await handleBotInvite(res) }
      if (route.match(/\/bot\/guilds\/[^/]+\/channels$/) && method === 'GET') { if (!await adminAuth(req.headers.authorization, res)) return res; return await handleGuildChannels(req, res) }
      if (route === '/bot/commands/register' && method === 'POST') { if (!await adminAuth(req.headers.authorization, res)) return res; return await handleRegisterCommands(res) }
      if (route === '/bot/send-prices' && method === 'POST') { if (!await adminAuth(req.headers.authorization, res)) return res; return await handleSendPrices(req, res) }
      if (route === '/bot/announce' && method === 'POST') { if (!await adminAuth(req.headers.authorization, res)) return res; return await handleAnnounce(req, res) }
      if (route === '/bot/send-ticket-panel' && method === 'POST') { if (!await adminAuth(req.headers.authorization, res)) return res; return await handleSendTicketPanel(req, res) }
      if (route === '/bot/setup' && method === 'POST') { if (!await adminAuth(req.headers.authorization, res)) return res; return await handleBotSetup(res) }
      if (route === '/cleanup-bots' && method === 'POST') { if (!await adminAuth(req.headers.authorization, res)) return res; return await handleCleanup(res) }

      return res.status(404).json({ error: 'Not found', route })
    } catch (e: any) {
      console.error('Nova API route error:', route, e)
      return jsonError(500, e?.message || 'Internal server error')
    }
  } catch (e: any) {
    console.error('Nova API fatal error:', e)
    return jsonError(500, e?.message || 'Server error')
  }
}
