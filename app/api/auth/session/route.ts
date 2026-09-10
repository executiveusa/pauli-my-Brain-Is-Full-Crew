import { NextRequest, NextResponse } from 'next/server'
import {
  OWNER_SESSION_COOKIE,
  authConfiguration,
  hasOwnerSession,
  issueOwnerSession,
  verifyOwnerAccessToken,
} from '@/lib/private-auth'

export async function GET(req: NextRequest) {
  const configured = authConfiguration().ownerLoginConfigured
  if (!configured) {
    return NextResponse.json({ authenticated: false, configured: false }, { status: 503 })
  }
  if (!hasOwnerSession(req)) {
    return NextResponse.json({ authenticated: false, configured: true }, { status: 401 })
  }
  return NextResponse.json({ authenticated: true, configured: true }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function POST(req: NextRequest) {
  const config = authConfiguration()
  if (!config.ownerLoginConfigured) {
    return NextResponse.json({ authenticated: false, error: 'BRAIN_OWNER_AUTH_NOT_CONFIGURED' }, { status: 503 })
  }

  let token = ''
  try {
    const body = await req.json()
    token = typeof body?.token === 'string' ? body.token.trim().slice(0, 2048) : ''
  } catch {
    return NextResponse.json({ authenticated: false, error: 'INVALID_REQUEST' }, { status: 400 })
  }

  if (!verifyOwnerAccessToken(token)) {
    return NextResponse.json({ authenticated: false, error: 'ACCESS_DENIED' }, { status: 401 })
  }

  const session = issueOwnerSession()
  if (!session) {
    return NextResponse.json({ authenticated: false, error: 'BRAIN_SESSION_NOT_CONFIGURED' }, { status: 503 })
  }

  const response = NextResponse.json({ authenticated: true }, { headers: { 'Cache-Control': 'no-store' } })
  response.cookies.set({
    name: OWNER_SESSION_COOKIE,
    value: session.value,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: session.maxAge,
  })
  return response
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false }, { headers: { 'Cache-Control': 'no-store' } })
  response.cookies.set({
    name: OWNER_SESSION_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  })
  return response
}
