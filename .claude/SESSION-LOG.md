# Claude Session Log — todo-new (Unstuck)

<!-- Newest entry on top. Do not edit past entries. -->

---

## 2026-06-10 — Sample maps + 3D labels and tree layout

**Branch:** `claude/feat/3d-lens` (continuing — all "make 3D good" work)

### What was done
- User direction: iterate the 3D model against domain-diverse examples
  (AI/learning vs programming vs building a shed) — different domains
  produce differently shaped graphs.
- `scripts/generate-samples.mjs` — runs three 2-turn prompts through the
  real /api/graph-step engine and writes `public/samples/*.json`.
  Samples are model output, not hand-written; regenerate when the system
  prompt changes.
- Map: "Load sample…" dropdown (fetch sample → replace graph with
  confirm → cose layout → save). Conversation resets; model sees the
  loaded map via the usual state injection.
- Space (3D): visible text labels via three-spritetext (pinned 1.10.0,
  sprite alongside sphere, dimmed ✓ labels when done) and a Tree layout
  toggle (dagMode 'td', onDagError tolerates cycles).
- `docs/EXAMPLES.md`: new "Sample Maps (graph-shape spec)" section — the
  expected shape per domain is the eyeball test for prompt regressions.

### Verification (live generation, 6 opus calls)
- learn-ai: 12 nodes, 3 blocks edges → parallel/exploratory ✓
- ship-app: 9 nodes, 6 blocks, 2 time-ish nodes ✓
- build-shed: 15 nodes, 11 blocks edges → dependency chain ✓
  Shapes match the spec table. Samples serve over HTTP.
- Both CDN pins resolve. WebGL still needs a human eyeball.
- Ops hygiene: found two orphaned node server processes (cause of the
  earlier 405); killed, port verified free. Watch .server.pid handling.

### Open items / next steps
- User: eyeball /space.html with each sample loaded; tree vs free layout.
- Timeline projection still pending; API key rotation still pending.

---

## 2026-06-09 (night) — Space: the 3D viewing lens; repo on GitHub

**Branch:** `claude/feat/3d-lens`

### What was done
- User created the GitHub remote (github.com/slimjim96/unstuck) and pushed
  `main` (= former claude/feat/graph-canvas tip). Claude work continues on
  claude/* branches per the workspace rules.
- Added `public/space.html` — the Space lens: read-only 3D projection via
  3d-force-graph (pinned 1.79.0, CDN). Reads the exact same localStorage
  graph the Map saves (`unstuck.graph`), converts Cytoscape element JSON
  to {nodes, links}, drops dangling edges defensively. Orbit/zoom, click
  to fly to a node, same color language as the Map (mode colors, stuck
  red, done dimmed, blocks edges amber with arrows).
- Live-syncs across tabs via the `storage` event — drag things on the Map
  in one tab, watch Space update in the other.
- Map topbar links to /space.html; README + CLAUDE.md updated (Space is a
  viewing lens; the Map remains the only editing surface).

### Verification
- CDN pin resolves (HTTP 200). Both pages serve with the right script
  tags and links. WebGL rendering itself can't be verified headlessly —
  user should eyeball /space.html in the browser.

### Open items / next steps
- Timeline projection (mode=time nodes onto a date axis).
- gh CLI not authenticated — PR created via the push URL instead.
- Reminder still open: user should rotate the Anthropic API key.

---

## 2026-06-09 (evening) — v1 direction: the Map (graph canvas)

**Branch:** `claude/feat/graph-canvas`

### What was done
- Direction shift from the user: not just one-step-at-a-time chat — they
  want the *shape* of many tasks/events visible and manipulable, inspired
  by how LLMs place related things near each other in vector space.
- Keystone decision (README → v1 Direction): **the graph is the single
  source of truth; views are projections.** Map (2D force canvas) is the
  editing surface; Focus (the v0 card) is the zoomed-in lens; timeline/3D
  are future projections. 3D deliberately a *viewing* lens, not editing.
- Contract: **AI proposes, user disposes** — model returns graph operations
  (add/update/remove node, add/remove edge), client applies them, user
  rearranges freely; model is shown current map state each turn and is
  instructed never to fight user edits.
- `server.js`: new `/api/graph-step` endpoint (graph system prompt +
  operations schema). Injects `[TODAY: date]` + `[CURRENT MAP STATE]` into
  the last user turn (not the system prompt — kept frozen per caching
  guidance).
- `public/index.html` → the Map: Cytoscape.js (CDN, pinned 3.30.2) canvas,
  chat side panel, node inspector (split smaller / done / rename / delete),
  manual add-node, auto-arrange (cose), localStorage persistence. New
  nodes placed near their parent; layout never auto-runs over user
  arrangement. Old card UI moved to `public/focus.html` (git mv).
- **Rule amended:** zero-dep is now server-side only; frontend libs allowed
  via CDN script tags (no build step). Reason: graph editing UI is not
  reasonably hand-rollable.

### Verification (live, two API calls)
- Turn 1 (two stuck things): two clean clusters, 2–4 children each,
  part_of edges, plus a real `blocks` dependency (find number → call).
  Bug found: model dated a deadline 2025 — fixed via [TODAY] injection.
- Turn 2 ("still too big" + date complaint, with graph state): split went
  down a level under the right node, and `update_node` corrected the year
  to 2026. Page serves with Cytoscape included.
- Known noise: model sometimes adds a stray irrelevant field on an op
  (e.g. `kind` on add_node) — harmless, applyOps ignores unknown fields.

### Incident
- A PowerShell command echoed the ANTHROPIC_API_KEY value into the local
  conversation transcript (parenthesized assignment). Not committed
  anywhere; **user advised to rotate the key** in the Anthropic console.

### Files touched
- `server.js` — `/api/graph-step`, GRAPH_SYSTEM_PROMPT, GRAPH_SCHEMA
- `public/index.html` — new Map UI (Cytoscape)
- `public/focus.html` — renamed from index.html, unchanged
- `README.md` — v1 Direction section (graph model, projections, contract)
- `CLAUDE.md` — load-bearing files + amended dependency rule

### Open items / next steps
- User dogfooding in the browser; tune max-children-per-turn and labels.
- Timeline projection (project `when`/`mode=time` nodes onto an axis).
- 3D viewing lens via `3d-force-graph` consuming the same elements JSON.
- Still no git remote — branches unpushed. User should rotate API key.

---

## 2026-06-09 (later) — Live API verified; structured-output schema fix

**Branch:** `claude/init/todo-new`

### What was done
- User set `ANTHROPIC_API_KEY` as a Windows user env var; loaded it from
  `HKCU:\Environment` into the session (new terminals pick it up natively).
- Verified the full loop live against claude-opus-4-8: stuck-thought →
  clarifying question (with default + not_today) → answer → one tiny action.
  Behavior matches docs/EXAMPLES.md example #1 almost word-for-word.
- **Bug found & fixed:** with all four schema fields required, the model
  leaked self-correction chatter into the `not_today` string (e.g.
  `"...today.}{\""`). Making `default` and `not_today` optional
  (`required: ["kind","text"]`) fixed it — two clean turns after the change.

### Files touched
- `server.js` — RESPONSE_SCHEMA: `default`/`not_today` now optional

### Verification
- Live two-turn conversation, clean JSON both turns. Frontend already
  guards both fields with falsy checks, so no UI change needed.

### Open items / next steps
- Real dogfooding by the user in the browser (http://localhost:3456).
- Still no git remote — branch unpushed.

---

**Branch:** `claude/init/todo-new`

### What was done
- Project born from a conversation about indecision/overthinking. Thesis:
  the bottleneck isn't motivation, it's that problems arrive too big — so
  this is a **decomposition engine for stuck things**, not a todo app.
- Wrote `README.md` (thesis, core loop, design principles, action bar) and
  `docs/EXAMPLES.md` (10 stuck-thoughts with ideal responses — this is the
  real spec, the prompt data, and the eyeball test suite).
- Built v0 prototype: `server.js` (zero-dependency Node 22 server, static
  files + `/api/next-step` proxy to Claude API, model `claude-opus-4-8`,
  adaptive thinking, structured outputs via `output_config.format`) and
  `public/index.html` (single-page UI: capture box → one card showing a
  question/action/message → did-it / still-too-big / answer buttons).
- Initialized repo on `claude/init/todo-new`, created `.claude/` state and
  project `CLAUDE.md`, registered in the global metadata/session files.

### Files touched
- `README.md` — concept doc
- `docs/EXAMPLES.md` — spec by example (load-bearing)
- `server.js` — entire backend; system prompt lives here
- `public/index.html` — entire frontend
- `CLAUDE.md`, `.claude/METADATA.json`, `.claude/SESSION-LOG.md` — scaffolding

### Verification
- Tests: no test suite yet; `node --check server.js` passes
- Manual: server boots, serves index.html (HTTP 200), `/api/next-step`
  rejects empty input with 400. Live Claude call NOT yet tested — needs
  `ANTHROPIC_API_KEY` set by the user.
- CI: none
- Docs updated: yes (all docs are new)

### Open items / next steps
- Dogfood: run with a real API key and feed it the 10 examples from
  `docs/EXAMPLES.md`; tune the system prompt against them.
- No git remote yet — branch cannot be pushed until one is created.
- Success criterion (from README): the loop must help its own author on
  real stuck things within a week of dogfooding.

---
