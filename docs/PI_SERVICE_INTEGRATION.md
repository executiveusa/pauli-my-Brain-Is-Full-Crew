# Pi Service Integration

Status: specification only. Preserve the current Crew and dashboard; do not replace them with a second brain implementation.

## Outcome

Expose the existing **My Brain Is Full - Crew** as Bambu's private Second Brain service for **Pi / Jeremy**, while retaining the current dashboard and ten-agent architecture.

This repository is the private knowledge-work service. It is not the public Animo Bambu site and it is not the Hermes business control plane.

## Verified current product

The fork already contains a Next.js dashboard with:

- note tree
- search
- note viewer
- agent activity panel

The existing UI should be reused, linked, or embedded through the private Pi realm rather than rebuilt from scratch.

## Critical pre-connection security blocker

The current `main` branch exposes these Next.js API handlers without an authentication check in the route itself:

- `GET /api/search` — searches the vault/Supabase index and can fall back to reading up to 200 vault notes.
- `GET /api/vault` — lists a vault path.
- `GET /api/note` — reads and parses a note by requested path.
- `GET /api/agent-log` — reads recent agent activity.
- `POST /api/agent-log` — writes an agent-log record.

This repository must therefore **not be exposed as an Internet-accessible Second Brain service or wired into Command Center as trusted private storage until an owner-authenticated, fail-closed boundary is added and tested**. Network placement alone is not sufficient proof.

Required remediation before connection:

1. Add one server-side authentication helper for the private service; deny when unconfigured.
2. Apply it to every `/api/*` route that reads or writes private brain state.
3. Add path validation/canonicalization before accepting a note/vault path so user input cannot escape the approved vault root.
4. Split read and write authority where practical; Pi initially needs read-only search/status, not arbitrary write access.
5. Add rate/size limits to query/path inputs and structured error responses.
6. Add automated checks proving unauthenticated search/vault/note/log requests fail closed.
7. Verify no Supabase service credentials, vault contents, Drive/OAuth tokens, or private paths reach client bundles or error payloads.

Until those checks pass, the correct integration state is `BLOCKED_SECURITY`, not `connected`.

## Preserve the Crew

The existing roles remain authoritative inside this service:

1. Architect — vault structure/setup
2. Scribe — capture
3. Sorter — inbox triage/filing
4. Seeker — retrieval
5. Connector — knowledge graph/linking
6. Librarian — maintenance/deduplication
7. Transcriber — audio/meeting processing
8. Postman — Gmail/Calendar bridge
9. Food Coach — opt-in advisory
10. Wellness Guide — opt-in advisory

Do not add a parallel crew simply to satisfy the Pi integration. Pi should route into these capabilities through a narrow adapter.

## Boundary model

```text
Private Command Center /pi
        |
        v
Pi / Jeremy service
        |
        v
Second Brain service adapter
        |
        +--> existing Crew
        +--> canonical private records/vault
        +--> Graphify-derived graph

Private brain --approved public projection only--> animobambu public site/social
```

The public site must never query this service directly.

## Initial private service contract

Use owner-authenticated server-to-server operations. HTTP/JSON is acceptable for the first slice; keep the domain interface replaceable so CLI/MCP/RPC adapters can be added later.

Read operations first:

- truthful health/status
- search brain with provenance
- fetch note/document by canonical ID/path
- agent activity summary
- pending duplicate/conflict review

Write operations later, after the read path is proven:

- capture via Scribe
- triage via Sorter
- graph/link analysis via Connector
- maintenance/dedupe via Librarian

No operation should report success without a real receipt/result from the underlying service.

## Canonical data and Graphify

The private vault / normalized records remain source of truth.

Graphify is a derived index/query layer. Its output is rebuildable and must not be the only copy of a memory or provenance record.

Connector/Librarian integration should preserve:

- canonical nodes and edges
- provenance to source records
- duplicate candidates
- conflict state
- merge ledger
- `EXTRACTED` vs `INFERRED` graph semantics where available

Duplicate cleanup is conservative: preserve originals; archive rather than destructively delete; identity conflicts require owner review.

## Google integration boundary

Pi's ingest layer owns approved Drive-root discovery and source manifests. This service receives approved normalized/private data or controlled source references. Do not put shared Drive URLs, raw OAuth credentials, or broad Drive tokens into client-side code.

Postman remains the Crew capability for Gmail/Calendar semantics. Connector availability must be reported truthfully.

## Sensitive data rules

- owner-only by default
- least-privilege tool access
- no OAuth/session/API secrets in vault notes, browser payloads, prompts, screenshots, logs, or durable memory
- no automatic publication of private correspondence
- health/medical information is excluded from public projection by default
- Food Coach and Wellness Guide remain advisory; they do not autonomously diagnose, prescribe, or approve medical actions

## First verifiable slice

1. document current dashboard/data path baseline
2. close the unauthenticated API blocker and prove all private routes fail closed
3. add private authenticated health/status contract
4. add private read-only search contract that returns provenance
5. connect Pi to those two operations
6. expose existing dashboard entry point from Command Center `/pi`

Do not add write actions, dedupe mutations, live Gmail/Calendar writes, or public publishing in this first slice.

## Acceptance proof

- current dashboard remains functional after auth is introduced
- every private API route fails closed when owner/service auth is absent
- note/vault path requests cannot escape the approved root
- status is truthful and does not synthesize counts/health
- private search returns source/provenance
- no private credentials appear in client bundles/responses
- existing Crew routing remains intact
- Graphify data can be removed/rebuilt without losing canonical memory
- rollback removes the Pi adapter/auth layer without changing vault contents
