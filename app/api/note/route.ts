import { NextRequest, NextResponse } from 'next/server'
import { authError, checkReadAuth } from '@/lib/private-auth'
import { readVaultFile, VaultPathError } from '@/lib/vault'
import { parseNote } from '@/lib/parse'

export async function GET(req: NextRequest) {
  const auth = checkReadAuth(req)
  if (!auth.authenticated) return authError(auth)

  const path = req.nextUrl.searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'PATH_REQUIRED' }, { status: 400 })

  try {
    const raw = await readVaultFile(path)
    const note = parseNote(path, raw)
    return NextResponse.json({
      ...note,
      provenance: {
        canonicalPath: note.path,
        sourceType: 'private-vault',
        retrieval: 'direct-note-read',
      },
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    if (err instanceof VaultPathError) {
      return NextResponse.json({ error: 'INVALID_VAULT_PATH' }, { status: 400 })
    }
    return NextResponse.json({ error: 'NOTE_UNAVAILABLE' }, { status: 502 })
  }
}
