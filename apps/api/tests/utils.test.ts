import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword, signJWT, verifyJWT } from '../src/utils'

const secret = 'test-secret'

describe('crypto utils', () => {
  it('hash/verify password', async () => {
    const { hash, salt } = await hashPassword('P@ssw0rd!')
    expect(hash).toBeTypeOf('string')
    expect(salt).toBeTypeOf('string')
    expect(await verifyPassword('P@ssw0rd!', hash, salt)).toBe(true)
    expect(await verifyPassword('wrong', hash, salt)).toBe(false)
  })

  it('sign/verify jwt', async () => {
    const token = await signJWT({ sub: 'u1', email: 'a@b.com' }, secret, 60)
    const payload = await verifyJWT(token, secret)
    expect(payload.sub).toBe('u1')
    expect(payload.email).toBe('a@b.com')
  })
})
