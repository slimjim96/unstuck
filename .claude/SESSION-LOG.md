# Claude Session Log — todo-new (Unstuck)

<!-- Newest entry on top. Do not edit past entries. -->

---

## HANDOFF — next session starts here (updated 2026-06-11, Phase 3 kit done)

**State:** all committed and pushed on `claude/feat/3d-lens`. The
user's REAL map lives in `data/` (gitignored) — tests must always use
`UNSTUCK_DATA=<temp>` + an alternate PORT. No servers left running.

**Phase 3 kit shipped (2026-06-11):** optional `UNSTUCK_TOKEN` gate on
/api/* (header or ?token= for SSE; browser prompts once on 401 and
remembers in localStorage), PWA manifest + SVG icon (standalone,
start_url = /focus.html), responsive Map (panel = bottom sheet ≤720px),
Dockerfile, docs/DEPLOY.md (Tailscale / VPS / fly.io). What remains of
Phase 3 is EXECUTION: the user picks a hosting path and we run it
together (their accounts/infra needed).

**Hosting decision (user, 2026-06-11): local LAN first, then a
Linux/CentOS box (possibly shared hosting).** DEPLOY.md reordered
accordingly: Option A = home LAN (the user still needs to run the
elevated New-NetFirewallRule command — port 3456, Private profile;
their Wi-Fi IP was 10.27.17.33, suggest a DHCP reservation), Option C
= CentOS (dnf, firewalld, SELinux) + cPanel/Passenger shared-hosting
subsection. SSE now sends x-accel-buffering: no for proxy buffering.

**Candidate next work:** CentOS deploy execution when the user has the
host; witness reading real op history from events.ndjson; ops-log
compaction; Map refit after phone rotation (dbl-tap canvas does it
manually); consider PR claude/feat/3d-lens → main (~20 commits).

**Still pending (user):** API key rotation, since 2026-06-09.

---

## (superseded) HANDOFF of 2026-06-10 — Phase 2 done

**State:** everything committed and pushed on `claude/feat/3d-lens`.
Working tree clean. No server left running; `data/` deliberately empty
so the user's browser graph migrates up on their first Map load.

**Where the product is:** the server owns the graph (`data/graph.json`
+ `events.ndjson`, gitignored). POST `/api/ops` is the single write
path (user edits and AI proposals; server is the only timestamp
stamper). SSE (`/api/events`) live-syncs all lenses across tabs and
devices, with own-echo suppression by client id. Old localStorage
graphs migrate up once (`unstuck.migrated` flag). Five lenses: Map
(edit→ops), Focus (picker + did-it op), Space/Timeline/Trail (read).
`/api/next-step` and the v0 focus prompt are gone.

**Next up: Phase 3 — out of the house** (personal tool, decided):
- Deploy somewhere reachable (tiny VPS / fly.io / home machine +
  Tailscale); add the shared secret token at that point (one env var,
  checked on /api/*; the lenses send it from a stored value).
- Phone: responsive pass (Map panel + Focus on small screens) + PWA
  manifest so it installs; SSE already covers cross-device sync.
- Maybe: ops-log compaction; witness reading real op history from
  events.ndjson (it currently uses day stamps only).

**Watch items:** Map applies its own edits locally and ignores its own
SSE echo — if two clients edit the SAME node simultaneously, last
write wins (fine for one person). Focus model-reply vs picker mismatch
(picker is authority). Headless screenshot + console is the frontend
verification bar; auto-answer JS dialogs in CDP drivers. Check the
3456 port owner before starting servers. **API key rotation still
pending (user, since 2026-06-09).**

---

## 2026-06-11 (later 2) — Phase 3 kit: token, PWA, phone, deploy guide

**Branch:** `claude/feat/3d-lens`

### What was done
- UNSTUCK_TOKEN gate (server): when set, /api/* requires the token —
  `x-unstuck-token` header, or `?token=` for EventSource (can't send
  headers). Unset = open (localhost daily use, zero friction). Static
  pages stay open; all data is behind /api.
- Client (app.js): Unstuck.api() wrapper — on 401, prompt() once,
  store in localStorage (unstuck.token), retry. SSE connects lazily
  after the first authorized load so the prompt has already happened.
  Map/Focus graph-step calls + Map's SSE refetch go through api().
- PWA: public/manifest.json (standalone, start_url /focus.html — the
  phone is the "show me my one step" surface), assets/icon.svg, links
  + theme-color on all five pages; .json/.svg content types added.
- Responsive Map: ≤720px → column layout, panel as 46vh bottom sheet,
  legend hidden. Focus/Trail/Timeline already fine.
- Dockerfile (node:22-alpine, COPY only — zero deps, no install) and
  docs/DEPLOY.md: Tailscale (recommended), VPS + systemd + Caddy,
  fly.io + volume; env table (ANTHROPIC_API_KEY, UNSTUCK_TOKEN,
  UNSTUCK_DATA, PORT); data is two files, moving = copying data/.

### Verification (isolated server: PORT 3457 + UNSTUCK_DATA temp)
- 15/15: 401 without/wrong token, 200 with header, SSE 401 vs ?token
  stream, manifest+icon content types and installable shape, static
  open without token; in-browser: prompt appeared once → graph loaded
  → token remembered; SSE with token delivered another client's op
  live; phone (390×844 emulation): panel stacked below canvas
  (screenshots: map-phone, focus-phone — Focus is a perfect phone
  surface). Real data/ verified intact (rev 2, 26 elements).

### Open items / next steps
- Deploy EXECUTION with the user (needs their accounts): pick
  Tailscale / VPS / fly.io per docs/DEPLOY.md.
- Phone rotation refit is manual (dbl-tap canvas) — fine for now.
- API key rotation still pending.

---

## 2026-06-11 (later) — Fix: top-left map after Phase 2; dbl-click centering

**Branch:** `claude/feat/3d-lens`

### What was done
- User dogfooding report: map "moved randomly, stuck in the upper-left."
  Root cause: Phase 2 made the graph load ASYNC (cy starts empty, adds
  elements later) — cytoscape only auto-fits constructor-time elements,
  so the viewport stayed at default pan/zoom. Fix: explicit cy.fit()
  once the elements arrive.
- Requested feature: double-click (two taps, same target, <350ms,
  manual detection — not relying on cytoscape dbltap) → node/edge
  animates to viewport center; double-click on empty canvas → fit the
  whole map.
- server.js: UNSTUCK_DATA env var overrides the data dir — needed
  because the user now has REAL data in data/ (rev 2, 26 elements);
  tests must run isolated (PORT=3457 + temp UNSTUCK_DATA). Also handy
  for Phase 3 deploys.

### Verification (CDP vs isolated server, script deleted)
- 3/3: nodes seeded at (5000,4000) visible after load (fit), dbl-click
  centers to within 12px, canvas dbl-click fits all. No console errors.
- User's real data/graph.json verified untouched after tests.

### Lesson
- The user has live data now: NEVER run tests against the default
  data/ or port 3456 without checking; always UNSTUCK_DATA + alt port.

---

## 2026-06-11 — Phase 2: the graph moves server-side

**Branch:** `claude/feat/3d-lens`

### What was done
- server.js: canonical graph store (cytoscape element JSON with
  positions — the user's arrangement is truth). data/graph.json via
  atomic tmp+rename; append-only data/events.ndjson (one line per
  commit: t, rev, client, ops/replace). Routes: GET /api/graph,
  POST /api/ops, PUT /api/graph (replace; stamps anything unstamped),
  GET /api/events (SSE + 25s heartbeat). commit() = rev++ → save →
  append → broadcast.
- Op semantics centralized server-side: server is the ONLY stamper
  (createdAt/touchedAt/doneAt); `null` field value = explicit clear
  (client-only channel — the model schema has no nulls); new
  `move_node` op never bumps touchedAt (arrangement ≠ engagement);
  add_node carries client-chosen x/y.
- /api/graph-step now builds the model snapshot from the server graph;
  clients send only {messages}. /api/next-step + v0 SYSTEM_PROMPT +
  RESPONSE_SCHEMA deleted (~90 lines).
- app.js: graph client — loadGraph() (one-time localStorage migration
  guarded by unstuck.migrated), sendOps(), replaceGraph(),
  onGraphChange() (EventSource, ignores own clientId echoes).
- Map: every edit → op (fields incl. null clears, done, delete, add,
  dragfree → move_node, auto-arrange → batched move_nodes after the
  layout settles, sample/clear → PUT replace). Model ops rendered
  locally (placeNear position written INTO the op) then forwarded.
  localStorage keeps only chat messages + theme.
- Focus: in-memory server copy refreshed via SSE; did-it → update_node
  op; capture/split ops forwarded after local render.
- Space/Timeline/Trail: read server graph, re-render on SSE.
- .gitignore: data/. README status + CLAUDE.md descriptions updated.

### Verification (two throwaway drivers, both deleted)
- API-level 17/17: op semantics (stamps, null-clear, move-not-touch,
  cascade delete), PUT stamping, 400 on bad ops, SSE hello/per-commit
  broadcast/client ids/replace event, graph.json rev + ndjson line
  count.
- Browser CDP 14/14: legacy localStorage migrated up on first Map
  load (flag set, server has it); inspector title edit → server label
  + touchedAt; **two-tab SSE: Trail tab live-updated when the Map tab
  marked a node done**; Focus picked from the server graph and did-it
  landed server-side; live opus split through Focus — 4 children on
  the server with server stamps and client positions ("Toss visible
  trash into bin" card). No console errors anywhere.
- Test data/ deleted afterwards so real migration starts clean.

### Open items / next steps
- Phase 3 (see HANDOFF above). API key rotation still pending.

---

## 2026-06-10 (cont. 7) — Phase 1 shipped: Focus joins the graph

**Branch:** `claude/feat/3d-lens`

### What was done
- **Focus rewritten as a graph projection** (public/focus.html):
  deterministic picker — candidates are open, type=step, not blocked by
  an open node ("blocks" semantics: source blocks target); ordered by
  stalest cluster (max touched across the part_of-root cluster), then
  smallest minutes, then oldest created. "I did it" writes status=done
  + doneAt/touchedAt directly into unstuck.graph (no API call; local
  rotating celebration lines). "Still too big"/capture/answers go
  through /api/graph-step with the same op vocabulary + stamps as the
  Map (Focus applyOps mirrors it on raw element JSON; new nodes placed
  near their parent's saved position, scatter fallback). Conversation
  is per-visit in-memory only — deliberately NOT shared with the Map's
  unstuck.messages (clobber risk); the graph itself is the memory.
- **Shared runtime** public/assets/app.js + app.css: pre-paint theme,
  Unstuck.palette() (one canvas palette for cytoscape/WebGL/SVG),
  Unstuck.onThemeChange(), nav injected into <nav data-nav>. All five
  pages refactored onto it; per-page palettes/theme code deleted.
- Old /api/next-step + SYSTEM_PROMPT remain in server.js but the UI no
  longer calls them — candidates for removal in Phase 2.

### Verification (CDP, 18/18 + screenshots, script deleted after)
- Picker: stalest-cluster pick, blocked-step skip, "Different one"
  fallback, did-it → doneAt in localStorage, Trail count picks it up,
  split-offer when nothing bite-sized, empty → capture.
- Map regression (sample load + inspector), theme via shared nav
  propagates across Space/Timeline, no console errors anywhere.
- Live split through Focus (1 opus call): "Clean the home office" →
  4 children; card showed "Empty trash and recycling (~5 min)". Note:
  the model's reply suggested a different child than the picker chose
  (picker = authority per hybrid decision) — watch whether that
  mismatch bothers in practice; could sort same-minutes children by
  the model's stated entry point later.
- Driver gotchas recorded: headless confirm() blocks forever — handle
  Page.javascriptDialogOpening; a crashed driver leaves an orphaned
  headless Edge holding the debug port (kill by command-line match).

### Open items / next steps
- Phase 2: graph server-side (GET /api/graph, POST /api/ops, SSE
  /api/events, data/graph.json + events.ndjson, localStorage migration).
- API key rotation STILL pending.

---

## 2026-06-10 (cont. 6) — Architecture decisions for v2 (the real app)

**Branch:** `claude/feat/3d-lens`

### What was done
- Architecture conversation for POC → real app. Current-state honesty:
  server already right-shaped (stateless proxy, key server-side);
  localStorage graph is the fragile core; Focus is an island.
- Four decisions made by the user (all recommended options accepted),
  recorded in README → "v2 Direction":
  1. Personal tool — no accounts, token at most, zero-dep rule lives.
  2. Focus integration FIRST, then server-side persistence.
  3. Hybrid Focus picker — deterministic client-side selection, model
     only for split/ask/witness.
  4. Snapshot + append-only ops log; one write path (POST /api/ops,
     same op vocabulary for user and AI); SSE for live sync.

### Next session: Phase 1 — Focus joins the graph
- Focus reads `unstuck.graph`, deterministic picker (open, unblocked,
  smallest minutes, stalest-cluster bias), "I did it" → done op +
  doneAt into the shared graph, "still too big" → /api/graph-step.
- Shared static `public/assets/app.js|css` for the theme + nav header
  (4 duplicated copies today; own code, not a dependency — allowed).
- Phase 2 after: GET /api/graph, POST /api/ops, GET /api/events (SSE),
  data/graph.json + data/events.ndjson, localStorage → migration source.

### Open items
- API key rotation STILL pending (day 2 of reminders).

---

## 2026-06-10 (cont. 5) — Gentle witness + Trail lens (TED roadmap done)

**Branch:** `claude/feat/3d-lens`

### What was done
- **Witness** (system prompt change — the careful one):
  - snapshot() now sends created/touched/done at day precision (cheap
    tokens, enough signal). Model still never sets them (schema has no
    timestamp props; applyOps wouldn't apply them anyway).
  - GRAPH_SYSTEM_PROMPT rule 10: one observation max, only when a stall
    is clearly the useful thing, evidence-based, counter-evidence
    offered, never diagnosing; re-split-but-stuck → lower the FEAR bar
    not the size bar; no observations on fresh maps or right after one.
  - docs/EXAMPLES.md: "The Gentle Witness" spec section (stalled map →
    ideal reply; fresh map → zero observations; hard limits list).
  - Live-tested on a second server instance (PORT=3457, user's 3456
    untouched): 3 opus calls. Fresh map → clean decomposition, no
    pattern talk. Stalled map ("what should I look at today?") → reply
    almost word-for-word the spec ("the garage is clearly rolling…
    hasn't been touched since June 3rd… not that you're avoiding it").
    Turn after observation → celebration only, no repeat.
- **Trail lens** (`public/trail.html`): done nodes grouped by doneAt day,
  newest first, pre-timestamp dones under "Earlier", cumulative count
  ("5 tiny steps done since sat, jun 6"), footer "Only what happened.
  No streaks, no gaps, no guilt." Pure HTML/CSS (no canvas → theme is
  CSS-vars only). Same lens contracts (localStorage, live-sync,
  ?sample=, theme). Cross-linked from Map/Space/Timeline topbars.
  README + CLAUDE.md updated.

### Verification
- Witness: the 3 live calls above (the graph-prompt equivalent of the
  10-example eyeball test; focus-lens SYSTEM_PROMPT untouched).
- Trail: CDP driver, 10/10 — empty state, count, subtitle, day order,
  Earlier last, open nodes excluded, snapshot day-precision fields.
  Dark + light screenshots eyeballed. node --check server.js passes.

### Open items / next steps
- **USER DIRECTION for next phase: turn the POC into a real app** with
  seamless integration from Focus to the other elements. Focus today is
  an island: separate endpoint (/api/next-step), no graph awareness, no
  persistence. Likely shape: Focus becomes a projection of the graph
  (pull the recommended next node, mark done back into the graph),
  shared nav/theme header, then the bigger questions — accounts/sync,
  a real datastore, deploy target, mobile. Discuss architecture first.
- API key rotation STILL pending (user reminder, day 2).

---

## 2026-06-10 (cont. 4) — Label-aware layout; 3D titles in front

**Branch:** `claude/feat/3d-lens`

### What was done
- User: Map titles overlap; 3D titles hidden behind spheres.
- Map: shared runLayout() — cose with nodeDimensionsIncludeLabels: true
  (label bounds count as node size), idealEdgeLength 130 (> the 110px
  wrapped-label width), componentSpacing 100. Used by Auto-arrange and
  sample load.
- Space: sprite labels moved fully below the sphere radius (-11/-7) and
  given depthTest=false, depthWrite=false, renderOrder=2 — titles always
  render in front of geometry.

### Verification (CDP driver, throwaway, deleted)
- Objective overlap metric: pairwise intersections of label-inclusive
  boundingBoxes on build-shed (15 nodes) — tuned 1 vs old 18. Both
  views screenshot-eyeballed; no console errors. (cose is random-init,
  so the count can vary run to run — the metric is the comparison, not
  the absolute number.)

### Files touched
- `public/index.html` — runLayout(); `public/space.html` — makeLabel()

### Open items / next steps
- Pattern-witness prompt change, done-trail lens (per TED roadmap).
- 3D initial camera distance could be closer (labels tiny until you
  zoom) — cosmetic, didn't touch.
- API key rotation STILL pending.

---

## 2026-06-10 (cont. 3) — Timestamps foundation + calm overdue

**Branch:** `claude/feat/3d-lens`

### Context
- User shared a Peter Sage TEDx summary (procrastination = unconscious
  programming + environment, not willpower). Ideation landed on four
  product ideas; user approved starting the first two:
  (1) timestamp foundation, (2) overdue-red → calm amber.
  Parked for later sessions: pattern-witness prompt change (model names
  avoidance signatures, ONE gentle observation max — needs EXAMPLES.md
  eyeball pass), done-trail/evidence lens, elephant-first splitting
  (lower the fear bar, not the effort bar, on repeated re-splits).
  Explicitly rejected: content feeds / media-audit features.

### What was done
- `createdAt` / `touchedAt` / `doneAt` (ISO) stamped on every node
  mutation path in the Map: applyOps add_node/update_node (done sets
  doneAt, reopen removes it), inspector field edits, Done toggle,
  manual add, sample load. Machine-set, never model-set; deliberately
  NOT in snapshot() yet — exposing them to the model is the
  pattern-witness feature's decision. Dragging is arrangement, not
  engagement: it does not bump touchedAt. README data model updated.
- Timeline: passed dates now amber ring + "date passed" meta instead of
  red "overdue" (README principle: no red badges; Sage: don't trigger
  the amygdala, inform calmly).

### Verification (CDP driver, throwaway, deleted)
- 15/15: all stamp paths assert against localStorage; reopen removes
  doneAt; pre-existing nodes get no invented createdAt; timeline shows
  amber "date passed" and zero red anywhere. Screenshot eyeballed.
- Driver gotcha: after programmatic applyOps the new node can render
  off-viewport (fit happened at load) — cy.fit() before computing click
  coords.
- User's own server on :3456 again (new PID) — used, left running.

### Files touched
- `public/index.html` — timestamps; `public/timeline.html` — amber;
  `README.md` — data model note

### Open items / next steps
- Next from the TED list: pattern-witness (prompt change → run the 10
  EXAMPLES.md cases), then done-trail lens (timestamps now exist).
- API key rotation STILL pending.

---

## 2026-06-10 (cont. 2) — Full node editing + light mode

**Branch:** `claude/feat/3d-lens`

### What was done
- User asked for (a) everything editable in Map view including title and
  description, (b) a light UI mode.
- Map inspector → real editor: Title, Detail, When, Minutes, Type, Mode
  all editable fields (shared bindField helper; empty optional fields
  removed via removeData so the model snapshot stays clean; Rename
  button retired — the Title input replaces it). Done/Split/Delete stay.
- Light mode on all four pages: `unstuck.theme` in localStorage, toggle
  button per page, cross-tab sync via storage event, pre-paint head
  script sets `html.light` to avoid a dark flash. CSS vars overridden
  under `html.light`; `color-scheme` set per theme (native widgets).
- Canvas colors are JS-side, so each view swaps a palette: Map calls
  cy.style().update() (style fns read the palette), Space re-sets the
  3d-force-graph accessors with FRESH closures (same fn reference would
  be a no-op for kapsule props), Timeline just re-renders its SVG.
- Light palette: bg #eef2f5, ink #1c2733, accent #1f9d7e, time #b87b2e,
  mixed #7263d2, stuck #c45c5c — same hues, darkened for contrast.

### Verification (CDP driver, throwaway script, deleted after)
- 13/13 assertions, zero console errors: all six fields persist to
  unstuck.graph; clearing detail removes the key; theme toggle sets
  html.light + persists; timeline/space/focus pick the theme up from
  localStorage; toggling on Space repaints WebGL. Screenshots of all
  four pages in light mode eyeballed — palettes consistent.
- Driver gotcha: Runtime.evaluate persists top-level `const` across
  calls in the page session — wrap per-call code in an IIFE.
- Ops: port 3456 was held by `node server.js` under a plain
  powershell.exe — the USER's own server, left running (it serves from
  disk per request, so changes apply on refresh). Check the owner
  before killing, every time.

### Files touched
- `public/index.html` — editor fields, theme system, cytoscape palette
- `public/timeline.html`, `public/space.html`, `public/focus.html` — theme

### Open items / next steps
- User eyeball: light mode taste pass (palette is my pick), 3D tuning,
  timeline. API key rotation still pending.

---

## 2026-06-10 (cont.) — Map inspector: editable "when" date

**Branch:** `claude/feat/3d-lens`

### What was done
- User feedback after the timeline shipped: "nothing seems editable and
  there is no when option in the right-hand panel." The lenses being
  read-only is by design, but the gap was real: the Map's node inspector
  had no way to set a date, so nothing could reach the timeline except
  AI-proposed dates.
- Added a When row to the node inspector (`public/index.html`): native
  `<input type="date">` (dark `color-scheme`) + "No date" clear button.
  Set/clear goes through the normal `save()` path → storage event →
  Timeline/Space live-sync; the model sees the date next turn via the
  usual state injection. `removeData("when")` on clear so the field
  disappears from the snapshot rather than going empty-string.
- Deliberately did NOT auto-flip `mode` to time/mixed when a date is set
  — the timeline keys on `when` alone; mode stays the model's/user's call.

### Verification (interactive, so screenshot alone wasn't enough)
- Drove headless Edge over CDP with a throwaway zero-dep Node script
  (global fetch + WebSocket): seeded localStorage with one node, clicked
  it (had to use cy.renderedPosition() — cytoscape auto-fits the
  viewport, model coords are NOT page coords), asserted panel opened,
  set 2026-06-20 via the input + change event → `when` persisted to
  `unstuck.graph`, meta line updated; "No date" cleared it. PASS; only
  console noise is the pre-existing cytoscape wheelSensitivity warning.
  Script deleted after. Screenshots eyeballed (panel matches theme).
- Ops: ANOTHER orphaned node was serving :3456 (EADDRINUSE on a fresh
  start mid-session, despite a clean port check minutes earlier). Used
  it for the test, then killed it; port verified free. Recurring theme —
  always check the port owner before starting the server.

### Files touched
- `public/index.html` — When row in node inspector (only change)

### Open items / next steps
- Maybe: minutes/detail editing in the inspector if the user wants more
  fields; timeline → Map node highlight. 3D/timeline eyeball round and
  API key rotation still pending.

---

## 2026-06-10 (later still) — Timeline lens: dated nodes on a date axis

**Branch:** `claude/feat/3d-lens`

### What was done
- Built the Timeline projection (pending since 2026-06-09):
  `public/timeline.html` — read-only lens projecting nodes with a `when`
  onto a horizontal date axis. Hand-rolled SVG, deliberately no CDN
  library (a date axis IS reasonably hand-rollable; the CDN exception
  exists for things that aren't).
- Features: today marker; adaptive ticks (daily ≤21d span, weekly ≤130d,
  monthly beyond); overdue = open + past date, flagged red; done dimmed
  with ✓; label collisions handled by alternating above/below the axis
  plus greedy lane stacking; tooltip with detail; resize re-render.
- `when` parsed as a LOCAL date ("YYYY-MM-DD" via new Date(y,m-1,d)) —
  Date.parse reads ISO dates as UTC, which shifts the day west of
  Greenwich.
- Same contracts as Space: reads `unstuck.graph` from localStorage,
  live-syncs via the storage event (localStorage mode only), supports
  `?sample=<name>`. Footer counts undated nodes that stay on the Map.
- Cross-links: Map and Space topbars → Timeline; Timeline → Map/Space/
  Focus. README v1 Direction + CLAUDE.md load-bearing files updated.

### Verification (headless screenshot bar, per last session's lesson)
- Headless Edge screenshots of three cases: a temporary date-rich sample
  (overdue red, done dimmed, same-day collision stacked, today aligned,
  weekly ticks — all correct), ship-app (1 dated node + today marker,
  "8 undated" count), learn-ai (no dates → correct empty-state message).
  Temp sample deleted after; samples/ remains model-output-only.
- Server booted clean, killed afterwards, port 3456 verified free.

### Files touched
- `public/timeline.html` — new (the whole lens)
- `public/index.html`, `public/space.html` — topbar links
- `README.md`, `CLAUDE.md` — docs

### Open items / next steps
- User eyeball: 3D tuning round AND the new timeline against samples.
- Possible later: timeline click → highlight node on the Map; dependency
  view. API key rotation STILL pending (third reminder).

---

## 2026-06-10 (later) — Fix: 3D view was blank; ESM + import map rewrite

**Branch:** `claude/feat/3d-lens`

### What was done
- User reported the 3D view broken (blank scene). Root cause confirmed by
  inspecting the UMD headers: `three-spritetext` binds to a global `THREE`
  (`e(t.THREE)`) that the 3d-force-graph standalone bundle never exposes —
  so `new SpriteText()` threw on the first node render and killed the
  whole scene. Introduced by the labels commit.
- Rewrote space.html to ES modules + import map (the library author's own
  pattern): `three` pinned via esm.sh, both libs imported with
  `?external=three`, so everything shares ONE three instance.
- Second bug surfaced by headless testing: three-render-objects@1.42
  imports `Timer` from three, which requires three >= 0.179 — pinned
  0.170 failed. Bumped import map to three@0.180.0.
- Added `?sample=<name>` URL param to space.html — loads a sample map
  directly (sharable lens + enables headless testing, since a fresh
  browser profile has no localStorage). storage live-sync only binds in
  localStorage mode.

### Verification — actually rendered this time
- Headless Edge (`--headless=new --enable-unsafe-swiftshader`) screenshot
  of /space.html?sample=build-shed: graph visibly renders — teal/violet
  nodes, amber blocks arrows, readable sprite labels. Console shows only
  WebGL perf warnings, no JS errors.
- Lesson recorded: CDN script tags were "verified" earlier only by HTTP
  200 — that checks existence, not compatibility. Headless screenshot +
  console log is now the verification bar for frontend changes.

### Files touched
- `public/space.html` — full rewrite of the script setup (ESM + import map)

### Open items / next steps
- 3D visual tuning round with the user against the three samples.
- Timeline projection; API key rotation still pending.

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
