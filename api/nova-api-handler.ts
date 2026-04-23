import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')
  
  if (req.method === 'OPTIONS') return res.status(200).end()
  
  const url = req.url || ''
  const pathname = new URL(url, 'http://localhost').pathname
  const prefix = '/api/nova-api-handler'
  const route = pathname === prefix || pathname === prefix + '/' ? '/' : pathname.slice(prefix.length) || '/'
  
  try {
    if (route === '/' || route === '/health') {
      return res.json({ status: 'ok', route, pathname, prefix })
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
    return res.status(404).json({ error: 'Not found', route })
  } catch (e: any) {
    return res.status(500).json({ error: e.message, route })
  }
}
