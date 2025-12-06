import { Hono } from 'hono'
import type { Env } from '../types'
import { run, one } from '../db'
import { signJWT } from '../utils'

// Minimal direct OAuth scaffold (authorization code) for Google/GitHub
// Note: For full production, prefer Cloudflare Access or handle PKCE securely.

export const oauth = new Hono<{ Bindings: Env }>()

function redirectUri(provider: 'google'|'github') {
  return `https://your-domain.example/oauth/${provider}/callback`
}

function randomString(len = 64) {
  const arr = crypto.getRandomValues(new Uint8Array(len))
  return btoa(String.fromCharCode(...arr)).replace(/[^a-zA-Z0-9]/g, '').slice(0, len)
}

async function codeChallenge(verifier: string) {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  const b64 = btoa(String.fromCharCode(...new Uint8Array(digest)))
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

oauth.get('/google/start', async c => {
  const clientId = await c.env.CACHE.get('GOOGLE_CLIENT_ID')
  if (!clientId) return c.json({ error: 'GOOGLE_CLIENT_ID not set' }, 500)
  const scope = encodeURIComponent('openid email profile')
  const redirect = encodeURIComponent(redirectUri('google'))
  const state = randomString(32)
  const verifier = randomString(64)
  const challenge = await codeChallenge(verifier)
  await c.env.CACHE.put(`oauth:google:${state}`, JSON.stringify({ verifier }), { expirationTtl: 600 })
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&response_type=code&scope=${scope}&redirect_uri=${redirect}&state=${state}&code_challenge=${challenge}&code_challenge_method=S256`
  return c.redirect(url)
})

oauth.get('/google/callback', async c => {
  const url = new URL(c.req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code || !state) return c.json({ error: 'Missing code/state' }, 400)
  const cache = await c.env.CACHE.get(`oauth:google:${state}`)
  if (!cache) return c.json({ error: 'Invalid state' }, 400)
  const { verifier } = JSON.parse(cache)
  // TODO: Exchange code+verifier for tokens at Google's endpoint
  const email = `user-${code}@google.local` // placeholder
  let user = await one<{ id: string; name: string }>(c.env, 'SELECT id, name FROM users WHERE email = ? LIMIT 1', email)
  if (!user) {
    const id = crypto.randomUUID()
    await run(c.env, 'INSERT INTO users (id, email, name, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?, ?)', id, email, 'Google User', '-', '-', Date.now())
    user = { id, name: 'Google User' }
  }
  const token = await signJWT({ sub: user.id, email }, c.env.JWT_SECRET)
  return c.json({ token })
})

oauth.get('/github/start', async c => {
  const clientId = await c.env.CACHE.get('GITHUB_CLIENT_ID')
  if (!clientId) return c.json({ error: 'GITHUB_CLIENT_ID not set' }, 500)
  const redirect = encodeURIComponent(redirectUri('github'))
  const state = randomString(32)
  await c.env.CACHE.put(`oauth:github:${state}`, '1', { expirationTtl: 600 })
  const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirect}&state=${state}`
  return c.redirect(url)
})

oauth.get('/github/callback', async c => {
  const url = new URL(c.req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code || !state) return c.json({ error: 'Missing code/state' }, 400)
  const ok = await c.env.CACHE.get(`oauth:github:${state}`)
  if (!ok) return c.json({ error: 'Invalid state' }, 400)
  // TODO: Exchange code for tokens at GitHub's endpoint
  const email = `user-${code}@github.local`
  let user = await one<{ id: string; name: string }>(c.env, 'SELECT id, email, name FROM users WHERE email = ? LIMIT 1', email)
  if (!user) {
    const id = crypto.randomUUID()
    await run(c.env, 'INSERT INTO users (id, email, name, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?, ?)', id, email, 'GitHub User', '-', '-', Date.now())
    user = { id, name: 'GitHub User' }
  }
  const token = await signJWT({ sub: user.id, email }, c.env.JWT_SECRET)
  return c.json({ token })
})
