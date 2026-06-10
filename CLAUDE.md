# Claude Code — todo-new (Unstuck)

> Project-specific instructions for Claude Code. Extends
> `_claude-projects/CLAUDE.md` and `~/.claude/CLAUDE.md`.

## What This Project Is

A decomposition engine for stuck things — not a todo app. It takes a vague,
looming problem ("my finances are a mess") and grinds it down to ONE tiny
next action (5–15 min, physical, concrete). v0 is a zero-dependency Node
server + single HTML page proxying to the Claude API. See `README.md` for
the thesis and `docs/EXAMPLES.md` for the spec-by-example.

## Health Check

```powershell
node --check server.js
```

(Run check: `$env:ANTHROPIC_API_KEY` must be set, then `node server.js` and
open http://localhost:3456)

## Active Branch

`claude/init/todo-new` (update as work progresses)

## Load-Bearing Files

- `docs/EXAMPLES.md` — the real spec: 10 stuck-thoughts + ideal responses;
  also the prompt-engineering data. Change behavior here first.
- `server.js` — entire backend: static files + `/api/next-step` (focus
  lens) + `/api/graph-step` (map lens) Claude proxies. Both system prompts
  and both response schemas live here.
- `public/index.html` — the Map: Cytoscape.js graph canvas + chat panel.
- `public/focus.html` — the Focus lens: original one-card-at-a-time UI.

## Session Reading Order

```
.claude/SESSION-LOG.md → README.md → docs/EXAMPLES.md
```

## Project-Specific Rules

- Zero npm dependencies server-side — Node 22 native APIs only. Frontend
  libraries are allowed via CDN `<script>` tags only (no build step);
  currently Cytoscape.js. Reason recorded in session log 2026-06-09:
  graph editing UI is not reasonably hand-rollable.
- The graph is the single source of truth; views are projections (see
  README → v1 Direction). AI proposes graph operations; the user's manual
  arrangement is never overridden.
- Any change to the system prompt must be checked against all 10 examples
  in `docs/EXAMPLES.md` (eyeball test).
- Proposed actions must satisfy the bar in README.md: physical, 5–15 min,
  singular, concrete. "Think about X" is never a valid output.
- Keep the UI to one visible thing at a time — no lists on the main screen.
