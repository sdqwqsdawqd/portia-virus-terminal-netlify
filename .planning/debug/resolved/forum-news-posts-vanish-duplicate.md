---
status: resolved
trigger: "1. when I create a post, like a forum thread or a news item, it gets deleted for some reason 2. when I create a new post in the forum, it gets duplicated"
created: 2026-10-14T12:20:00Z
updated: 2026-10-18T13:41:02Z
goal: find_root_cause_only
---

## Current Focus

bug_class: Bohrbug (deterministic once the trigger ordering happens; the trigger itself is timing/multi-device)
hypothesis: CONFIRMED (logic-level repro). Deleted = desktop fetchContent applies every GET unconditionally (content + revision), so a stale/late GET reverts a saved post in a clean editor, and a second editor's dirty draft inherits the newest revision and overwrites the post without a 409. Duplicated = broadcast handlers address posts by render-time array index while "+ НОВОЕ СООБЩЕНИЕ" inserts at index 0, and the format panel keeps a FormatTarget whose onCommit is bound to the old index, so the next style commit writes the old post's text into the new post.
next_action: hand diagnosis back (find_root_cause_only); fix belongs to plan-phase --gaps

reasoning_checkpoint:
  hypothesis: "Posts vanish because portia-desktop.tsx fetchContent (320-342) overwrites content and revision with whatever GET returns, older or not, and keeps advancing revision under a dirty editor draft; posts duplicate because portia-editor.tsx:969-975 write next.broadcasts[index] with a captured index while the add uses unshift, and FormatTarget.onCommit (1427/1441, used at 1572) is never refreshed on add."
  confirming_evidence:
    - "Repro S1 (real historyReducer/changedSections): save -> late GET -> editor posts [] , desktop rev 5 while DB rev 6; next save 409"
    - "Repro S2: phone dirty draft polls, revision becomes 11, phone save accepted (rev 12), post A deleted from DB, PC poll syncs it away"
    - "Repro S3: format onCommit bound to index 0, add post (unshift), commit style -> both posts body 'текст A'"
    - "Live DB (read-only GET, rev 122): orphan formattedText for deleted posts broadcast-mv1567ss / mv2le2ht; second post broadcast-mv7ynf84 is an untouched default created 55 s after the first"
  falsification_test: "If fetchContent ignored responses with revision <= current and PUT carried the draft's base revision, S1/S2 would end with A still present / a 409; if handlers resolved posts by id, S3 would leave the new post empty."
  fix_rationale: "Fix the shared sync decision (monotonic revision + base revision owned by the draft) and id-addressed updates, not the symptoms (e.g. not by disabling the poll)."
  blind_spots: "Owner's exact click sequence/device is unknown; no browser run (editor needs a Supabase session and saves would write the live DB). Which trigger the owner hit (second device, late GET, live-site CDN) is inferred, not observed."
  candidate_causes:
    - "code: fetchContent unconditional overwrite + revision bump under dirty draft (portia-desktop.tsx:320-342, 809)"
    - "code: index-addressed broadcast handlers + stale FormatTarget after unshift (portia-editor.tsx:966-975, 1427, 1441, 1572)"
    - "environment/config: saves from `next dev` never purge the Netlify CDN (purgeCache has no token locally) and the GET is cached s-maxage=300 + stale-while-revalidate=86400, so the live site serves the pre-save copy"
    - "environment: PC (localhost), phone (LAN dev) and the live site all edit one Supabase row"
    - "data: normalizePortiaContent — eliminated"
  and_gate: "yes for 'deleted': RC1 code defect AND a trigger (second editor instance with an unsaved draft, or a GET older than the last save: in-flight poll or a stale CDN copy). For 'duplicated': RC2 code defect AND the format panel targeting an existing post when a post is added."

## Symptoms

expected: A forum thread / news item created in the editor stays after saving, exactly once, and survives reload/sync.
actual: (1) a created post "gets deleted for some reason"; (2) a new forum post "gets duplicated".
errors: None reported.
reproduction: Create a post in the editor (Сообщения tab: "+ НОВОЕ СООБЩЕНИЕ"), save. Device unknown (PC and phone).
started: Reported during phase 3 UAT re-test (posts in the live DB were created 2026-10-14 10:21-10:22 UTC = 15:21-15:22 local).

## Eliminated

- hypothesis: normalizePortiaContent drops or re-creates posts (missing ids, required-field filter)
  evidence: lib/portia-content-normalize.ts returns `broadcasts: candidate.broadcasts` and `infoSections: candidate.infoSections` verbatim; no filter, no id generation, no dedupe.
  timestamp: 2026-10-14

- hypothesis: Date.now() id collision makes two posts share an id
  evidence: makeId (portia-editor.tsx:88) = Date.now base36 + 5 random base36 chars; live ids unique (dupIds 0); the two current posts are 55 s apart.
  timestamp: 2026-10-14

- hypothesis: StrictMode / reducer double-invoke adds the post twice
  evidence: historyReducer clones present before running the updater (editor-history.ts:31-32); each invocation starts from the same base, so a re-run gives one post (at most a different id), never two.
  timestamp: 2026-10-14

- hypothesis: remote sync merges server content into the draft by index
  evidence: "sync" is a whole-document replace via initHistory (editor-history.ts:61-62), only when not dirty (portia-editor.tsx:571-578). No merge exists.
  timestamp: 2026-10-14

- hypothesis: 03-04/03-05/WR-01 history or selection changes re-dispatch the add
  evidence: only five dispatch sites (575 sync, 613 change, 624 undo/redo, 750 saved, 1168 discard); history stores snapshots, not updaters; undo/redo restore snapshots with the same ids. Broadcasts have no drag handle.
  timestamp: 2026-10-14

- hypothesis: pointer + click double-fire on the add button
  evidence: "+ НОВОЕ СООБЩЕНИЕ" has only onClick (portia-editor.tsx:975); no window pointer listener touches broadcasts.
  timestamp: 2026-10-14

- hypothesis: bug introduced in phase 3
  evidence: origin/main (deployed, pre-phase-3) has the same unconditional fetchContent (setRevision(payload.revision ?? 0)) and the same index-bound broadcast onChange / onCommit: onChange. Both date back to 25bcbb2 / 5001944 (2026-10-08/11).
  timestamp: 2026-10-14

## Evidence

- timestamp: 2026-10-14
  checked: grep for forum/форум/thread/новост in app, components, lib
  found: No forum model exists. "Forum post / news item" = Broadcast (type quest|task|news) edited in the editor tab "Сообщения" (components/portia-editor.tsx:962-976), shown to visitors in the "Сводка" window (portia-desktop.tsx:1119-1124), published-only.
  implication: Scope is content.broadcasts (infoSections share the same handler shape).

- timestamp: 2026-10-14
  checked: lib/portia-content-normalize.ts normalizePortiaContent
  found: broadcasts and infoSections are returned as-is.
  implication: Server normalization cannot delete or duplicate a post.

- timestamp: 2026-10-14
  checked: add handler portia-editor.tsx:975, makeId (:88), clone (:89)
  found: `changeDraft((next) => next.broadcasts.unshift({ id: makeId("broadcast"), type: "news", title: "", body: "", published: false }))`; deep JSON clone.
  implication: Add itself is single; it inserts at index 0 and shifts every existing post's index by +1.

- timestamp: 2026-10-14
  checked: components/portia-desktop.tsx fetchContent (320-342), poll (421, every 30 s), saveContent (801-833)
  found: fetchContent calls setContent(payload.content) and setRevision(payload.revision ?? 0) for every OK response, with no comparison to the current revision and no awareness of an unsaved editor draft. saveContent sends `revision` from desktop state (809). There is no ordering between an in-flight poll and a save.
  implication: (a) a GET older than the last save reverts content+revision; a clean editor then syncs and the post disappears. (b) a dirty editor keeps its old draft but the desktop revision jumps to the newest, so its save passes the server's `eq("revision", base)` check and overwrites newer content.

- timestamp: 2026-10-14
  checked: portia-editor.tsx sync effect (571-578), lib/editor-history.ts sync/saved
  found: when !dirty, any new `content` object replaces the draft (initHistory). After a successful save the editor is clean, so the next poll result is adopted wholesale.
  implication: Whatever fetchContent stores becomes the editor draft within one tick.

- timestamp: 2026-10-14
  checked: app/api/content/route.ts PUT
  found: optimistic check `update(row).eq("id","main").eq("revision", baseRevision)`; 409 when no row matched.
  implication: The guard is correct, but only as good as the revision the client sends; RC1 feeds it the newest revision for an old draft.

- timestamp: 2026-10-14
  checked: node repro (scratchpad/repro.ts) with the real historyReducer, changedSections, normalizePortiaContent and a simulated desktop + server
  found: |
    S1 late GET: save -> rev 6, editor [A]; late GET -> editor [], desktop rev 5, DB rev 6; next save HTTP 409; next poll leaves dirty draft without A and rev 6 (next save would delete A).
    S2 second device: PC saves A (rev 11); phone (unsaved edit) polls -> rev 11, draft without A; phone save accepted (rev 12), DB [] ; PC poll -> editor [].
    S3 stale format target: post A body "текст A" at index 0, panel target bound to index 0; "+ НОВОЕ СООБЩЕНИЕ"; style commit -> [{broadcast-4 body "текст A"}, {broadcast-3 body "текст A"}].
  implication: Both symptoms reproduce deterministically from the current code once the trigger ordering occurs.

- timestamp: 2026-10-14
  checked: FormatTarget lifecycle (portia-editor.tsx:35-42, 1423-1442, 1569-1573; setFormatTarget(null) only at 620, 677, 685, 1165)
  found: FormatTarget.onCommit is the FormattedTextarea onChange from the render that activated it; for broadcasts that closure writes `next.broadcasts[index].body` (971). The add (975) and delete (968) do not clear or refresh formatTarget; on PC the floating panel stays open, and the global ✎ button keeps the old target everywhere.
  implication: After an add, the next colour/size/background/reset in the panel writes the old post's text into whatever post now holds the old index (the new one) -> visible duplicate. After a delete it writes into the wrong post, or throws a TypeError in the reducer when the index is past the end.

- timestamp: 2026-10-14
  checked: live public GET https://portia-database.netlify.app/api/content (read-only, no writes)
  found: revision 122, updatedAt 2026-10-14T10:25:56Z. broadcasts = [broadcast-mv7ynf84 (created 10:22:05 UTC, empty, unpublished), broadcast-mv7ym8zf (created 10:21:10 UTC, body "ывфывфыв", published)]. formattedText still holds broadcast:broadcast-mv1567ss (2026-10-09, "фывфывфывыф") and broadcast:broadcast-mv2le2ht (2026-10-10, "Тут эээ появились сотрудники, также анимации, дизайн и тд тд.") whose posts are gone. Cache-Status: "Netlify Durable"; fwd=stale; ttl=-105065; "Netlify Edge"; fwd=miss; stored.
  implication: Posts really were removed (a real news post from Oct 10 among them); deletes leave orphan formattedText. The 10:22:05 post is a genuine second makeId call (untouched defaults), consistent with the owner adding again; not a render artifact. The GET is CDN-cached.

- timestamp: 2026-10-14
  checked: node_modules/@netlify/functions/dist/main.js purgeCache; lib/portia-cdn.ts
  found: purgeCache skips (NETLIFY_LOCAL) or throws without NETLIFY_PURGE_API_TOKEN; purgeCacheTag swallows the error. GET carries Netlify-CDN-Cache-Control `public, durable, s-maxage=300, stale-while-revalidate=86400`.
  implication: Every save made from `next dev` (all phase 3 UAT testing) leaves the production CDN copy stale; the live site then serves and polls the pre-save content (post "missing") for minutes, and its own fetchContent writes that copy to localStorage and to `revision`.

- timestamp: 2026-10-14
  checked: test/dev context (03-0x-PLAN test steps, git status, origin/main)
  found: phase 3 code is local only (branch ahead of origin by 136); UAT runs `npx next dev -p 3123` on PC and on the phone over LAN (-H 0.0.0.0); both and the live site hit the same Supabase row.
  implication: Several editor instances against one row is the normal test setup, so the S2 trigger is realistic.

## Resolution

root_cause: |
  RC1 (deleted): components/portia-desktop.tsx fetchContent (320-342) adopts every GET response unconditionally (setContent + setRevision), with no revision ordering and no regard for an unsaved draft. A GET older than the last save (in-flight poll, or a stale CDN copy) reverts content and revision, and the clean editor syncs it in (portia-editor.tsx:571-578), so the saved post disappears. A second editor (phone/other tab) with an unsaved draft gets its revision bumped by the poll, so its save passes the 409 guard (route.ts eq revision) and silently overwrites the post. AND-gate: needs the trigger (second editor or late/stale GET).
  RC1 contributing (environment): saves from `next dev` never purge the Netlify CDN (no purge token), and /api/content is cached s-maxage=300 + stale-while-revalidate=86400, so the live site keeps serving the pre-save copy.
  RC2 (duplicated): broadcast handlers address posts by render-time index (portia-editor.tsx:968-972) while "+ НОВОЕ СООБЩЕНИЕ" inserts at index 0 (975). The format panel's stored FormatTarget.onCommit (1427/1441, called at 1572) is that index-bound closure and is not cleared on add/delete, so the next style commit copies the old post's text into the new post.
fix: (not applied — find_root_cause_only)
verification: logic-level repro only (scratchpad/repro.ts S1/S2/S3); no browser run
files_changed: []
