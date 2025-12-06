import { Hono } from 'hono'
import type { Env } from '../types'
import { run, one, upsertUserByEmail } from '../db'
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
  // Exchange code+verifier for tokens at Google's endpoint
  const clientId = await c.env.CACHE.get('GOOGLE_CLIENT_ID')
  const clientSecret = await c.env.CACHE.get('GOOGLE_CLIENT_SECRET')
  const redirect = redirectUri('google')
  let email = ''
  if (clientId && clientSecret) {
    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirect,
        code_verifier: verifier,
      }).toString()
    })
    const data = await resp.json()
    const idToken = data.id_token
    if (idToken) {
      // Decode without verification for email claim; production should verify JWT signature
      const parts = idToken.split('.')
      const payload = JSON.parse(atob(parts[1]))
      email = payload.email
    }
  }
  if (!email) email = `user-${code}@google.local`
  const user = await upsertUserByEmail(c.env, email, 'Google User')
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
  // Exchange code for tokens at GitHub's endpoint
  const clientId = await c.env.CACHE.get('GITHUB_CLIENT_ID')
  const clientSecret = await c.env.CACHE.get('GITHUB_CLIENT_SECRET')
  let email = ''
  if (clientId && clientSecret) {
    const resp = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'accept': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code })
    })
    const data = await resp.json()
    if (data.access_token) {
      const eresp = await fetch('https://api.github.com/user/emails', { headers: { authorization: `Bearer ${data.access_token}`, 'user-agent': 'taskflow-zero' } })
      const emails = await eresp.json()
      const primary = Array.isArray(emails) ? emails.find((e: any) => e.primary && e.verified)?.email : ''
      email = primary || ''
    }
  }
  if (!email) email = `user-${code}@github.local`
  const user = await upsertUserByEmail(c.env, email, 'GitHub User')
  const token = await signJWT({ sub: user.id, email }, c.env.JWT_SECRET)
  return c.json({ token })
})
