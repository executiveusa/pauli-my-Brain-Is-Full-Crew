# Private Second Brain API Boundary

## Mode
Brownfield hardening. Preserve the existing dashboard, Crew roles, vault source abstraction, and current data.

## Outcome
Make the existing Second Brain safe to connect to Pi / Jeremy without exposing the private vault or write actions to unauthenticated internet requests.

## Trust model

- Browser owner access: `BRAIN_OWNER_TOKEN` is exchanged for an HttpOnly, SameSite=Strict, signed session cookie.
- Pi / Command Center read access: `Authorization: Bearer <BRAIN_SERVICE_TOKEN>`.
- Agent write access: `Authorization: Bearer <BRAIN_WRITE_TOKEN>`.
- Read and write service credentials must be different values in deployment.
- No route returns credential values or stores them in browser local storage.

## Protected routes

Read scope:

- `GET /api/status`
- `GET /api/search?q=...`
- `GET /api/vault?path=...`
- `GET /api/note?path=...`
- `GET /api/agent-log`

Write scope:

- `POST /api/agent-log`

Owner session bootstrap:

- `GET /api/auth/session`
- `POST /api/auth/session`
- `DELETE /api/auth/session`

## Path confinement

Vault paths reject absolute paths, parent traversal, dot segments, hidden path segments, backslashes, null bytes, and oversized inputs. Direct note reads are limited to Markdown files.

## Provenance

Search and note responses include the canonical vault path and retrieval mechanism. The Supabase index remains derived; a direct-vault fallback does not replace the canonical note.

## Truth contract

- Unconfigured authentication returns 503 rather than silently opening access.
- Unauthorized requests return 401.
- Backend read failures return an error rather than an invented empty success state where correctness matters.
- Agent-log writes return success only after Supabase returns a write receipt.
- `/api/status` reports configuration/health booleans but never secret values.

## Rollback

Restore point before this slice: `main@38bcfb58fafef9216db3e3f08d45e98d0cde2161`.

Rollback is a branch/PR revert. No vault content, Supabase rows, Drive archives, or Graphify data are migrated or deleted by this slice.
