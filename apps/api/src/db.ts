import type { Env } from './types'

export async function run(env: Env, sql: string, ...params: any[]) {
  return env.DB.prepare(sql).bind(...params).run()
}

export async function all<T = any>(env: Env, sql: string, ...params: any[]) {
  const res = await env.DB.prepare(sql).bind(...params).all<T>()
  return res.results as T[]
}

export async function one<T = any>(env: Env, sql: string, ...params: any[]) {
  const res = await env.DB.prepare(sql).bind(...params).first<T>()
  return res as T | null
}

export async function upsertUserByEmail(env: Env, email: string, name = 'User') {
  const existing = await one<{ id: string; name: string }>(env, 'SELECT id, name FROM users WHERE email = ? LIMIT 1', email)
  if (existing) return existing
  const id = crypto.randomUUID()
  await env.DB.prepare('INSERT INTO users (id, email, name, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, email, name, '-', '-', Date.now())
    .run()
  // Ensure membership in a default team
  const team = await one<{ id: string }>(env, 'SELECT t.id FROM teams t JOIN team_members m ON m.team_id = t.id WHERE m.user_id = ? LIMIT 1', id)
  if (!team) {
    const teamId = crypto.randomUUID()
    await env.DB.prepare('INSERT INTO teams (id, name, created_at) VALUES (?, ?, ?)').bind(teamId, `${name}'s Team`, Date.now()).run()
    await env.DB.prepare('INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, ?)').bind(teamId, id, 'owner').run()
  }
  return { id, name }
}
