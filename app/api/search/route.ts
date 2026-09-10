import { NextRequest, NextResponse } from 'next/server'
import { authError, checkReadAuth } from '@/lib/private-auth'
import { searchVaultIndex } from '@/lib/supabase'
import { walkVaultMd, readVaultFile } from '@/lib/vault'
import { parseNote } from '@/lib/parse'
import Fuse from 'fuse.js'

const MAX_QUERY_CHARS = 256

export async function GET(req: NextRequest) {
  const auth = checkReadAuth(req)
  if (!auth.authenticated) return authError(auth)

  const raw = req.nextUrl.searchParams.get('q') ?? ''
  const q = raw.trim()
  if (!q) return NextResponse.json({ results: [] }, { headers: { 'Cache-Control': 'no-store' } })
  if (q.length > MAX_QUERY_CHARS) {
    return NextResponse.json({ error: 'QUERY_TOO_LONG' }, { status: 400 })
  }

  try {
    const rows = await searchVaultIndex(q)
    if (rows.length > 0) {
      const results = rows.map((row) => ({
        ...row,
        provenance: {
          canonicalPath: row.path,
          sourceType: 'private-vault',
          retrieval: 'supabase-index',
        },
      }))
      return NextResponse.json({ results, source: 'supabase' }, { headers: { 'Cache-Control': 'no-store' } })
    }
  } catch {
    // Fall through to direct vault search; no success is claimed for the index.
  }

  try {
    const files = await walkVaultMd('', 4)
    const notes = await Promise.all(
      files.slice(0, 200).map(async (file) => {
        try {
          const rawNote = await readVaultFile(file.path)
          return parseNote(file.path, rawNote)
        } catch {
          return null
        }
      })
    )
    const valid = notes.filter(Boolean) as NonNullable<typeof notes[0]>[]
    const fuse = new Fuse(valid, {
      keys: ['title', 'body', 'tags'],
      threshold: 0.4,
      includeScore: true,
    })
    const results = fuse.search(q, { limit: 20 }).map((result) => ({
      path: result.item.path,
      title: result.item.title,
      body: result.item.body.slice(0, 300),
      tags: result.item.tags,
      score: result.score,
      provenance: {
        canonicalPath: result.item.path,
        sourceType: 'private-vault',
        retrieval: 'direct-vault-fallback',
      },
    }))
    return NextResponse.json({ results, source: 'fuse' }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'PRIVATE_SEARCH_UNAVAILABLE' }, { status: 502 })
  }
}
