import { NextRequest, NextResponse } from 'next/server'
import { authError, checkReadAuth } from '@/lib/private-auth'
import { listVaultPath, VaultPathError } from '@/lib/vault'

export async function GET(req: NextRequest) {
  const auth = checkReadAuth(req)
  if (!auth.authenticated) return authError(auth)

  const path = req.nextUrl.searchParams.get('path') ?? ''
  try {
    const files = await listVaultPath(path)
    return NextResponse.json({ files }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    if (err instanceof VaultPathError) {
      return NextResponse.json({ error: 'INVALID_VAULT_PATH' }, { status: 400 })
    }
    return NextResponse.json({ error: 'VAULT_UNAVAILABLE' }, { status: 502 })
  }
}
