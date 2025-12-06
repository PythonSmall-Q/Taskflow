export type Role = 'owner' | 'admin' | 'member' | 'guest'
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done'

export type Env = {
  DB: D1Database
  FILES: R2Bucket
  CACHE: KVNamespace
  AI: Ai
  JWT_SECRET: string
  ROOM_DO: DurableObjectNamespace<RoomDurableObject>
  // Optional: Cloudflare Access JWKs URL stored in KV or secret
  ACCESS_JWKS_URL?: string
}

export type JWTPayload = {
  sub: string
  email: string
  teamId?: string
  exp: number
}

declare global {
  class RoomDurableObject {
    constructor(state: DurableObjectState, env: Env)
    fetch(request: Request): Promise<Response>
    broadcast(data: any): void
  }
}

// Shared Hono context generics for the API
export type AppContext = {
  Bindings: Env
  Variables: {
    user?: JWTPayload | { id: string; scopes?: string[] }
    access?: unknown
  }
}
