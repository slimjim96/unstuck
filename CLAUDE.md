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
- `server.js` — entire backend: static files + `/api/next-step` Claude proxy.
  The system prompt lives here.
- `public/index.html` — entire frontend (single file, no dependencies).

## Session Reading Order

```
.claude/SESSION-LOG.md → README.md → docs/EXAMPLES.md
```

## Project-Specific Rules

- Zero npm dependencies in v0 — Node 22 native APIs only. Adding a package
  needs an explicit reason recorded in the session log.
- Any change to the system prompt must be checked against all 10 examples
  in `docs/EXAMPLES.md` (eyeball test).
- Proposed actions must satisfy the bar in README.md: physical, 5–15 min,
  singular, concrete. "Think about X" is never a valid output.
- Keep the UI to one visible thing at a time — no lists on the main screen.
