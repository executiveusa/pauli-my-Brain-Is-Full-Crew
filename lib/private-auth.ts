import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

export const OWNER_SESSION_COOKIE = 'brain_owner_session'
const SESSION_TTL_SECONDS = 12 * 60 * 60

type AuthResult = {
  authenticated: boolean
  actor?: 'owner' | 'service'
  scope?: 'read' | 'write'
  status?: number
  error?: string
}

type SessionPayload = {
  sub: 'owner'
  iat: number
  exp: number
  v: 1
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

function sessionSecret(): string | null {
  const value = process.env.BRAIN_SESSION_SECRET?.trim()
  return value || null
}

function sign(value: string): string | null {
  const secret = sessionSecret()
  if (!secret) return null
  return createHmac('sha256', secret).update(value).digest('base64url')
}

function readBearer(req: NextRequest): string | null {
  const header = req.headers.get('authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || null
}

function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false
  const [payloadEncoded, signature, extra] = token.split('.')
  if (!payloadEncoded || !signature || extra) return false

  const expected = sign(payloadEncoded)
  if (!expected || !safeEqual(signature, expected)) return false

  try {
    const payload = JSON.parse(Buffer.from(payloadEncoded, 'base64url').toString('utf8')) as SessionPayload
    const now = Math.floor(Date.now() / 1000)
    return payload.sub === 'owner' && payload.v === 1 && payload.iat <= now + 60 && payload.exp > now
  } catch {
    return false
  }
}

export function authConfiguration() {
  return {
    ownerLoginConfigured: Boolean(process.env.BRAIN_OWNER_TOKEN?.trim() && sessionSecret()),
    readServiceConfigured: Boolean(process.env.BRAIN_SERVICE_TOKEN?.trim()),
    writeServiceConfigured: Boolean(process.env.BRAIN_WRITE_TOKEN?.trim()),
  }
}

export function verifyOwnerAccessToken(token: string): boolean {
  const expected = process.env.BRAIN_OWNER_TOKEN?.trim()
  if (!expected || !token) return false
  return safeEqual(token, expected)
}

export function issueOwnerSession(): { value: string; maxAge: number } | null {
  if (!sessionSecret()) return null
  const now = Math.floor(Date.now() / 1000)
  const payload: SessionPayload = { sub: 'owner', iat: now, exp: now + SESSION_TTL_SECONDS, v: 1 }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = sign(encoded)
  if (!signature) return null
  return { value: `${encoded}.${signature}`, maxAge: SESSION_TTL_SECONDS }
}

export function hasOwnerSession(req: NextRequest): boolean {
  return verifySessionToken(req.cookies.get(OWNER_SESSION_COOKIE)?.value)
}

export function checkReadAuth(req: NextRequest): AuthResult {
  if (hasOwnerSession(req)) return { authenticated: true, actor: 'owner', scope: 'read' }

  const bearer = readBearer(req)
  const expected = process.env.BRAIN_SERVICE_TOKEN?.trim()
  if (bearer) {
    if (!expected) return { authenticated: false, status: 503, error: 'BRAIN_READ_AUTH_NOT_CONFIGURED' }
    if (safeEqual(bearer, expected)) return { authenticated: true, actor: 'service', scope: 'read' }
    return { authenticated: false, status: 401, error: 'BRAIN_AUTH_REQUIRED' }
  }

  const config = authConfiguration()
  if (!config.ownerLoginConfigured && !config.readServiceConfigured) {
    return { authenticated: false, status: 503, error: 'BRAIN_READ_AUTH_NOT_CONFIGURED' }
  }
  return { authenticated: false, status: 401, error: 'BRAIN_AUTH_REQUIRED' }
}

export function checkWriteAuth(req: NextRequest): AuthResult {
  if (hasOwnerSession(req)) return { authenticated: true, actor: 'owner', scope: 'write' }

  const bearer = readBearer(req)
  const expected = process.env.BRAIN_WRITE_TOKEN?.trim()
  if (bearer) {
    if (!expected) return { authenticated: false, status: 503, error: 'BRAIN_WRITE_AUTH_NOT_CONFIGURED' }
    if (safeEqual(bearer, expected)) return { authenticated: true, actor: 'service', scope: 'write' }
    return { authenticated: false, status: 401, error: 'BRAIN_WRITE_AUTH_REQUIRED' }
  }

  const config = authConfiguration()
  if (!config.ownerLoginConfigured && !config.writeServiceConfigured) {
    return { authenticated: false, status: 503, error: 'BRAIN_WRITE_AUTH_NOT_CONFIGURED' }
  }
  return { authenticated: false, status: 401, error: 'BRAIN_WRITE_AUTH_REQUIRED' }
}

export function authError(result: AuthResult) {
  const status = result.status || 401
  const response = NextResponse.json({ error: result.error || 'BRAIN_AUTH_REQUIRED' }, { status })
  response.headers.set('Cache-Control', 'no-store')
  if (status === 401) response.headers.set('WWW-Authenticate', 'Bearer')
  return response
}
