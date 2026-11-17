# API Coverage — Supabase Storage (`portia-media`), PostgREST RPC, Netlify cache purge

> Full coverage by default. Opt-outs are explicit, reasoned decisions.
> Phase 25 adds no new external service: it uses two more methods of the Supabase Storage client the site already uses (plan 25-02), two new signed RPCs (plan 25-01) and leaves the Netlify purge to the owner (D-07).

| capability | decision | reason |
|---|---|---|
| storage.upload | INTEGRATE | |
| storage.getPublicUrl | INTEGRATE | |
| storage.copy | INTEGRATE | |
| storage.remove | INTEGRATE | |
| storage.list | OPT-OUT | explicitly out of scope — listing is closed for visitors by D-11 / SEC-05; editors do not need it |
| storage.download | OPT-OUT | not needed — images are served by the exact public link (D-11) |
| storage.move | OPT-OUT | not needed — D-13 copies first and removes the old file only after the record is saved |
| storage.update | OPT-OUT | not needed — object paths are random UUIDs and never overwritten |
| storage.createSignedUrl | OPT-OUT | explicitly out of scope — private bucket and temporary links are a Deferred Idea in 25-CONTEXT.md |
| storage.createSignedUrls | OPT-OUT | explicitly out of scope — private bucket and temporary links are a Deferred Idea in 25-CONTEXT.md |
| storage.bucket-admin | OPT-OUT | explicitly out of scope — the bucket stays public and unchanged (D-12); the agent applies nothing to any project (D-03) |
| rpc.portia_content_read | INTEGRATE | |
| rpc.portia_employees_read | INTEGRATE | |
| netlify.purge-by-tag | OPT-OUT | not needed in code this phase — the owner purges `portia-content` and `portia-employees` by checklist (D-07); the existing `purgeCacheTag` calls in editor writes stay one release |
| netlify.purge-site | OPT-OUT | not needed in code — owner fallback «Clear cache and deploy site» in 25-OWNER-CHECKLIST.md |
