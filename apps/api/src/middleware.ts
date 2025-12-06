import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env, JWTPayload } from './types'
import { getBearer, verifyJWT } from './utils'
import { jwtVerify, createRemoteJWKSet } from 'jose'

export const withCors = cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization']
})

export const authMiddleware = new Hono<{ Bindings: Env }>()
  .use('*', async (c, next) => {
    const token = getBearer(c.req.raw)
    if (!token) return c.json({ error: 'Unauthorized' }, 401)
    try {
      const payload = await verifyJWT(token, c.env.JWT_SECRET)
      c.set('user', payload as JWTPayload)
      await next()
    } catch {
      return c.json({ error: 'Invalid token' }, 401)
    }
  })

// Validate Cloudflare Access JWT if present (cf-access-jwt-assertion)
export const accessMiddleware = new Hono<{ Bindings: Env }>()
  .use('*', async (c, next) => {
    const cfJwt = c.req.header('cf-access-jwt-assertion')
    if (!cfJwt) return next()
    // Verify against Cloudflare Access JWKs endpoint
    const jwksUrl = (await c.env.CACHE.get('ACCESS_JWKS_URL')) || c.env.ACCESS_JWKS_URL
    if (!jwksUrl) return c.json({ error: 'Access JWKs not configured' }, 500)
    try {
      const JWKS = createRemoteJWKSet(new URL(jwksUrl))
      const { payload } = await jwtVerify(cfJwt, JWKS)
      c.set('access', payload)
      return next()
    } catch (e) {
      return c.json({ error: 'Invalid Access token' }, 401)
    }
  })

// Simple KV-based rate limit: X requests per window per token/IP
export function rateLimit(limit = 100, windowMs = 60_000) {
  return async (c: any, next: any) => {
    const keyBase = c.req.header('authorization') || c.req.header('cf-connecting-ip') || 'anon'
    const bucket = `rl:${Math.floor(Date.now() / windowMs)}:${keyBase}`
    const current = parseInt((await c.env.CACHE.get(bucket)) || '0', 10)
    if (current >= limit) return c.json({ error: 'Rate limit exceeded' }, 429)
    await c.env.CACHE.put(bucket, String(current + 1), { expirationTtl: Math.ceil(windowMs / 1000) })
    return next()
  }
}
