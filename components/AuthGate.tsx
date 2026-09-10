'use client'

import { FormEvent, ReactNode, useEffect, useState } from 'react'
import { Brain, Loader2, LockKeyhole } from 'lucide-react'

export default function AuthGate({ children }: { children: ReactNode }) {
  const [checking, setChecking] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)
  const [token, setToken] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' })
      .then(async (res) => ({ ok: res.ok, data: await res.json().catch(() => ({})) }))
      .then(({ ok, data }) => {
        if (!active) return
        setAuthenticated(Boolean(ok && data.authenticated))
        if (!ok && data.configured === false) setError('Owner authentication is not configured on this service.')
      })
      .catch(() => {
        if (active) setError('Private session check failed.')
      })
      .finally(() => {
        if (active) setChecking(false)
      })
    return () => { active = false }
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!token.trim()) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token: token.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.authenticated) throw new Error(data.error || 'Access denied')
      setToken('')
      setAuthenticated(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Access denied')
    } finally {
      setSubmitting(false)
    }
  }

  if (checking) {
    return (
      <div className="h-screen bg-zinc-950 text-zinc-400 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Checking private session…</span>
      </div>
    )
  }

  if (!authenticated) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center px-6">
        <form onSubmit={submit} className="w-full max-w-sm border border-zinc-800 bg-zinc-900/60 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <Brain className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h1 className="font-semibold">Second Brain</h1>
              <p className="text-xs text-zinc-500">Private owner session</p>
            </div>
          </div>

          <label className="text-xs text-zinc-400" htmlFor="owner-token">Owner access token</label>
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-3">
            <LockKeyhole className="w-4 h-4 text-zinc-500" />
            <input
              id="owner-token"
              type="password"
              autoComplete="current-password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              className="w-full bg-transparent py-3 text-sm outline-none"
              placeholder="Enter private access token"
            />
          </div>

          {error ? <p className="mt-3 text-xs text-red-400">{error}</p> : null}

          <button
            type="submit"
            disabled={submitting || !token.trim()}
            className="mt-4 w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium disabled:opacity-40"
          >
            {submitting ? 'Verifying…' : 'Open private brain'}
          </button>
          <p className="mt-3 text-[11px] leading-relaxed text-zinc-600">
            The token is exchanged for an HttpOnly signed session and is not stored in browser local storage.
          </p>
        </form>
      </main>
    )
  }

  return <>{children}</>
}
