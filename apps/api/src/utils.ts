import { SignJWT, jwtVerify } from 'jose'
import type { JWTPayload } from './types'

export const json = (data: unknown, init: number | ResponseInit = 200) =>
  new Response(JSON.stringify(data), {
    status: typeof init === 'number' ? init : init.status ?? 200,
    headers: { 'content-type': 'application/json; charset=UTF-8', ...(typeof init === 'object' ? init.headers : {}) },
  })

export async function hashPassword(password: string, salt?: string) {
  const enc = new TextEncoder()
  const saltBytes = salt ? Uint8Array.from(atob(salt), c => c.charCodeAt(0)) : crypto.getRandomValues(new Uint8Array(16))
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits', 'deriveKey'])
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
  const raw = await crypto.subtle.exportKey('raw', key)
  const hashB64 = btoa(String.fromCharCode(...new Uint8Array(raw)))
  const saltB64 = btoa(String.fromCharCode(...saltBytes))
  return { hash: hashB64, salt: saltB64 }
}

export async function verifyPassword(password: string, hash: string, salt: string) {
  const res = await hashPassword(password, salt)
  return res.hash === hash
}

export async function signJWT(payload: Omit<JWTPayload, 'exp'>, secret: string, ttlSeconds = 60 * 60 * 24 * 7) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds
  const key = new TextEncoder().encode(secret)
  const token = await new SignJWT({ ...payload, exp })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setExpirationTime(exp)
    .sign(key)
  return token
}

export async function verifyJWT(token: string, secret: string) {
  const key = new TextEncoder().encode(secret)
  const { payload } = await jwtVerify(token, key)
  return payload as unknown as JWTPayload
}

export function getBearer(req: Request) {
  const auth = req.headers.get('authorization') || ''
  const m = auth.match(/^Bearer\s+(.+)$/i)
  return m ? m[1] : null
}
