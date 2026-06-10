# Unstuck (working title)

> A decomposition engine for stuck things — not another todo app.

## Thesis

The bottleneck for getting things done isn't motivation, it's that problems
arrive too big. "Deal with my finances" isn't an action, it's a fog. Nobody
can *do* a fog, so the brain files it under "later" and calls that laziness.

Most todo apps assume you already know what to do and just need a place to
write it down. They're storage for decisions you haven't made yet — which is
why every abandoned todo list is really a list of undecided things wearing
task costumes.

This app takes a vague, looming thing and grinds it down until one piece is
small enough that **doing it is easier than avoiding it.**

## The Core Loop

```
dump a stuck thought
        │
        ▼
at most two clarifying questions (prefer zero)
        │
        ▼
ONE tiny next action  (5–15 min, physical, concrete)
        │
        ├─► "did it"        → celebrate briefly, offer the next one
        └─► "still too big" → split it again, smaller
```

## Design Principles

1. **The unit of input is a "stuck thing," not a task.** The capture box
   accepts full sentences, anxiety and all: "I keep meaning to figure out
   the garage."
2. **Show one thing, ever.** A list of 40 items is where motivation goes to
   die. The home screen shows a single next action. Everything else stays
   hidden until that one is done or deliberately skipped.
3. **The app does the thinking; the user does the doing.** The LLM asks at
   most two clarifying questions, then proposes the smallest first step.
   Overthinking is the user's job being done badly — outsource it.
4. **Make "good enough" a button.** Indecision feeds on open options.
   Offer a default; let the user accept "fine, that one" without guilt.
   Tone: calm friend, never a productivity drill sergeant.
5. **Forgiveness is a feature.** No streaks, no red badges. Coming back
   after two weeks feels like nothing happened: "Welcome back. Here's the
   smallest thing."

## What Counts as a Valid Next Action

A proposed action MUST be:

- **Physical** — describable as a body doing something ("open your email
  and search 'tax return 2024'"), never a mental state ("think about",
  "figure out", "plan", "decide").
- **Small** — 5–15 minutes, doable today, no prerequisites.
- **Singular** — one action, no "and then".
- **Concrete** — a stranger could verify it happened.

## v1 Direction: The Map (graph canvas)

The chat card (v0) shows one step at a time — right for the moment of
paralysis, but it throws away the *shape* of a life: many tasks, events,
and half-formed worries relating to each other. v1 makes that shape
visible and manipulable.

**Keystone decision: the graph is the single source of truth; every
visualization is a projection of it.**

- *Map view* — force-directed 2D canvas (Cytoscape.js): clusters emerge
  from relatedness, user drags/rewires/deletes freely.
- *Focus view* — the v0 one-tiny-step card: the zoomed-all-the-way-in lens.
- *Space view* — 3D lens (`3d-force-graph`, `/space.html`): orbit, zoom,
  fly to a node. Deliberately a *viewing* lens, not an editing surface —
  it reads the same saved graph and live-syncs when the Map changes.
- *Timeline view* — date-axis lens (`/timeline.html`): nodes with a `when`
  land on a horizontal axis with a today marker; passed dates get a calm
  amber flag. Read-only like Space — same saved graph, live-syncs.
- *Trail view* — evidence lens (`/trail.html`): everything you've finished,
  grouped by day, with a cumulative count. The unconscious doesn't believe
  pep talks; it believes evidence. Anti-streak by design: only days where
  something happened appear — no gaps, no guilt.
- *Dependency views* — later projections of the same data.

**The contract: AI proposes, user disposes.** Claude returns graph
*operations* (add/split/link/annotate); they land on the canvas; the user
accepts, moves, rewires, or deletes at will. The model is always shown the
user's current arrangement and never fights it.

### Graph data model

Nodes: `id`, `label` (short), `type` (`stuck | task | step | event`),
`mode` (`step | time | mixed` — step-based vs time-based, the two axes
most tasks live on), `minutes` (effort estimate), `when` (date, for
time-based), `status` (`open | done`), `detail`. The client also stamps
`createdAt` / `touchedAt` / `doneAt` (ISO timestamps, machine-set, never
model-set) — the raw material for noticing stalled things later.

Edges: `kind` = `part_of` (decomposition), `blocks` (dependency),
`related` (same life area).

## Prototype Scope (v0)

Prove the loop, nothing else:

- Single-page web app, zero frontend dependencies.
- Tiny Node server (no npm packages — Node 22 native `fetch`) that proxies
  to the Claude API. Key comes from `ANTHROPIC_API_KEY` env var.
- No accounts, no database, no persistence beyond the browser tab.
- Success criterion: the loop helps its own author on real stuck things
  within a week of dogfooding. If it doesn't, no feature will save it.

## Spec by Example

The real spec lives in [docs/EXAMPLES.md](docs/EXAMPLES.md) — ten real
stuck-thoughts and the ideal app response for each. Those examples are
simultaneously the product spec, the prompt-engineering data, and the
eyeball test cases.
