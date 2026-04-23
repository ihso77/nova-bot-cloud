import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')
  
  if (req.method === 'OPTIONS') return res.status(200).end()
  
  // req.url can be relative like "/api/nova-api-handler/health" or full
  let pathname = ''
  try {
    const fullUrl = req.url.startsWith('http') ? req.url : `https://localhost${req.url}`
    pathname = new URL(fullUrl).pathname
  } catch {
    pathname = req.url || '/'
  }
  
  const prefix = '/api/nova-api-handler'
  const route = pathname === prefix || pathname === prefix + '/' ? '/' : pathname.slice(prefix.length) || '/'
  
  try {
    if (route === '/' || route === '/health') {
      return res.json({ status: 'ok', route, pathname })
    }
    if (route === '/deploy' && req.method === 'POST') {
      return res.status(401).json({ error: 'Unauthorized', route })
    }
    if (route === '/stop' && req.method === 'POST') {
      return res.status(401).json({ error: 'Unauthorized', route })
    }
    if (route === '/status' && req.method === 'GET') {
      return res.status(400).json({ error: 'Missing serviceId', route })
    }
    if (route === '/payment' && req.method === 'POST') {
      return res.status(401).json({ error: 'Unauthorized', route })
    }
    if (route === '/verify' && req.method === 'POST') {
      return res.status(400).json({ error: 'Missing token', route })
    }
    if (route === '/discord-check' && req.method === 'GET') {
      return res.status(401).json({ error: 'Unauthorized', route })
    }
    if (route === '/bot/stats' && req.method === 'GET') {
      return res.status(401).json({ error: 'Unauthorized', route })
    }
    if (route.match(/\/tool\/purchase\/[^/]+$/)) {
      return res.status(401).json({ error: 'Unauthorized', route })
    }
    // Admin routes
    if (route === '/bot/info' || route === '/bot/invite' || route === '/bot/setup') {
      return res.status(401).json({ error: 'Unauthorized', route })
    }
    if (route === '/bot/commands/register' || route === '/bot/send-prices' || route === '/bot/announce' || route === '/bot/send-ticket-panel' || route === '/cleanup-bots') {
      return res.status(401).json({ error: 'Unauthorized', route })
    }
    if (route.match(/\/bot\/guilds\/[^/]+\/channels$/)) {
      return res.status(401).json({ error: 'Unauthorized', route })
    }
    return res.status(404).json({ error: 'Not found', route })
  } catch (e: any) {
    return res.status(500).json({ error: e.message, route })
  }
}
