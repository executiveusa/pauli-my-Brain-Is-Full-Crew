import { NextRequest, NextResponse } from 'next/server'
import { authError, checkReadAuth, checkWriteAuth } from '@/lib/private-auth'
import { getSupabase, writeAgentAction } from '@/lib/supabase'
import { normalizeVaultPath, VaultPathError } from '@/lib/vault'

export async function GET(req: NextRequest) {
  const auth = checkReadAuth(req)
  if (!auth.authenticated) return authError(auth)

  try {
    const sb = getSupabase()
    const { data, error } = await sb
      .from('agent_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) throw error
    return NextResponse.json({ logs: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'AGENT_LOG_UNAVAILABLE' }, { status: 502 })
  }
}

export async function POST(req: NextRequest) {
  const auth = checkWriteAuth(req)
  if (!auth.authenticated) return authError(auth)

  try {
    const body = await req.json()
    const agent = typeof body?.agent === 'string' ? body.agent.trim().slice(0, 80) : ''
    const action = typeof body?.action === 'string' ? body.action.trim().slice(0, 500) : ''
    const detail = typeof body?.detail === 'string' ? body.detail.trim().slice(0, 4000) : undefined
    const notePath = typeof body?.note_path === 'string' && body.note_path.trim()
      ? normalizeVaultPath(body.note_path, { markdownOnly: true })
      : undefined

    if (!agent || !action) {
      return NextResponse.json({ error: 'AGENT_AND_ACTION_REQUIRED' }, { status: 400 })
    }

    const receipt = await writeAgentAction(agent, action, notePath, detail)
    return NextResponse.json({
      ok: true,
      receipt: { id: receipt.id, created_at: receipt.created_at },
    }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    if (err instanceof VaultPathError) {
      return NextResponse.json({ error: 'INVALID_VAULT_PATH' }, { status: 400 })
    }
    return NextResponse.json({ error: 'AGENT_LOG_WRITE_FAILED' }, { status: 502 })
  }
}
