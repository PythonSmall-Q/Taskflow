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
