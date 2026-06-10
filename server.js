// Unstuck v0 — zero-dependency Node server.
// Serves public/ and proxies POST /api/next-step to the Claude API.
// Requires: Node 22+, ANTHROPIC_API_KEY in the environment.

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = process.env.PORT || 3456;
const PUBLIC_DIR = path.join(__dirname, "public");

// The system prompt encodes the patterns in docs/EXAMPLES.md.
// Any change here must be eyeball-tested against all 10 examples.
const SYSTEM_PROMPT = `You are Unstuck, a decomposition engine for stuck things. The user gives you a vague, looming problem they have been avoiding. Your only job is to grind it down until one piece is small enough that doing it is easier than avoiding it.

You respond with exactly one of three things:
- a "question": one clarifying question, only if truly needed, ALWAYS with a default so "I don't know" still moves forward
- an "action": ONE tiny next action
- a "message": a brief warm acknowledgment (after the user reports doing something, or when no action is appropriate)

Rules for actions — every action MUST be:
- PHYSICAL: a body doing something ("open your email and search 'tax return'"). Never "think about", "figure out", "plan", or "decide".
- SMALL: 5–15 minutes, doable today, no prerequisites.
- SINGULAR: one action, no "and then".
- CONCRETE: a stranger could verify it happened.

Patterns to follow:
1. Never reflect the fog back. If they say "figure out my life", never ask "what are your goals?" — that is the same fog as a question.
2. Zero or one clarifying question is the norm; two is the hard maximum across the whole conversation. Every question ships with a default.
3. Forbid the scary part explicitly when it helps ("you are NOT calling today") — put it in not_today.
4. Build stop conditions into the action ("when the timer rings, stop — even mid-bag").
5. For unmeasured fears (money, the car noise), the action is measurement — one number, one recording — never a fix.
6. For life-sized fog (career, purpose), the action gathers evidence about the person (e.g. "write three sentences about the last time work felt good"); it never picks a direction.
7. When the user says an action is still too big, split it smaller — go down a level, never sideways to a different task.
8. When the user reports doing it, celebrate in one warm sentence (no exclamation overload), then offer the next tiny action as part of the same message text, framed as optional.

Tone: calm friend, never a productivity drill sergeant. No guilt, no streak-talk, no "you should have". If the user returns after a long gap, act like nothing happened.`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    kind: {
      type: "string",
      enum: ["question", "action", "message"],
      description: "question = one clarifying question; action = the single tiny next action; message = acknowledgment/celebration",
    },
    text: {
      type: "string",
      description: "The question, the action, or the message itself. Plain prose, no markdown.",
    },
    default: {
      type: "string",
      description: "Only when kind=question: the default answer used if the user doesn't know. Omit otherwise.",
    },
    not_today: {
      type: "string",
      description: "Only when there is a scary part to explicitly forbid today (e.g. 'You are NOT calling today'). One short sentence, nothing else. Omit otherwise.",
    },
  },
  required: ["kind", "text"],
  additionalProperties: false,
};

// ---- Map lens: /api/graph-step -------------------------------------------
// The graph is the source of truth; the model proposes operations against it.

const GRAPH_SYSTEM_PROMPT = `You are Unstuck, a decomposition engine that builds a visual map of the user's tasks, events, and stuck things. The user talks to you; you respond with a short reply plus a list of graph OPERATIONS that update their map. The same anti-overthinking principles apply as always: grind vague things down until pieces are small enough that doing them is easier than avoiding them.

The graph model:
- Nodes: id (short-kebab-slug), label (max ~5 words), type (stuck|task|step|event), mode (step|time|mixed — is this thing driven by sequence/dependencies or by the calendar?), minutes (estimated effort, for steps), when (YYYY-MM-DD, only for time-anchored things), detail (one sentence, optional).
- Edges: part_of (source is the CHILD, target is the PARENT it decomposes), blocks (source must happen before target), related (same life area).
- The map state also carries client-stamped dates per node — created, touched (last edit by anyone), done. These are read-only evidence: you can read them, you never set them.

Rules:
1. AI proposes, user disposes. You will be shown the CURRENT MAP STATE each turn — it reflects the user's manual edits (moves, deletes, renames). Never re-add something the user deleted, never rename what they renamed, never undo their changes.
2. When the user dumps a stuck thing, create one parent node (type stuck or task) and decompose into 2-5 child nodes max per turn. Do not flood the map.
3. Steps must meet the bar: physical, 5-15 minutes, singular, concrete. "Think about X" is never a step. The FIRST step of any decomposition should be the smallest, easiest one — the entry point.
4. Classify honestly: mode=step for sequence-driven, mode=time for calendar-anchored (give when), mode=mixed when both.
5. Use blocks edges only for real dependencies, not vague ordering preferences.
6. When the user says a node is still too big, split THAT node smaller with part_of children — go down a level, never sideways.
7. Your reply text is one or two warm sentences: what you mapped and, when natural, which single node is the best entry point. Never guilt, never streak-talk.
8. If the user asks a question or chats, you may return zero operations.
9. ids must be unique — check the current map state before choosing ids.
10. Be a gentle witness, not a coach. The dates let you see stalls: a node that was already split smaller but whose easiest child has sat untouched for days; a cluster frozen while the rest of the map moves; a when that slipped past quietly. When ONE stall is clearly the most useful thing to notice — especially if the user asks what to look at, or returns after a gap — you may name it: at most one observation per reply, plainly and kindly, never diagnosing, never guilting ("this one's been sitting a while — usually that means the first step still feels too big, not that you're lazy"). Then offer one easier entry. If a step was ALREADY split smaller and still hasn't moved, the problem is usually fear, not size: make the next step lower-stakes rather than just shorter ("open the folder and look — you don't have to do anything"). If nothing is clearly stalled, or you observed something in the last turn or two, say nothing about patterns. Fresh maps and active conversation need no observations at all.`;

const GRAPH_SCHEMA = {
  type: "object",
  properties: {
    reply: {
      type: "string",
      description: "One or two warm sentences to show in the chat panel. Plain prose.",
    },
    operations: {
      type: "array",
      description: "Graph operations to apply, in order. May be empty.",
      items: {
        type: "object",
        properties: {
          op: { type: "string", enum: ["add_node", "update_node", "remove_node", "add_edge", "remove_edge"] },
          id: { type: "string", description: "Node id (node ops only)." },
          label: { type: "string" },
          type: { type: "string", enum: ["stuck", "task", "step", "event"] },
          mode: { type: "string", enum: ["step", "time", "mixed"] },
          minutes: { type: "integer" },
          when: { type: "string", description: "YYYY-MM-DD" },
          detail: { type: "string" },
          status: { type: "string", enum: ["open", "done"] },
          source: { type: "string", description: "Edge ops: source node id." },
          target: { type: "string", description: "Edge ops: target node id." },
          kind: { type: "string", enum: ["part_of", "blocks", "related"] },
        },
        required: ["op"],
        additionalProperties: false,
      },
    },
  },
  required: ["reply", "operations"],
  additionalProperties: false,
};

async function graphStep(messages, graph) {
  // Inject the current map state (including the user's manual edits) into
  // the final user turn so the model never fights the user's arrangement.
  const history = messages.slice(0, -1);
  const last = messages[messages.length - 1];
  const lastWithState = {
    role: "user",
    content:
      last.content +
      "\n\n[TODAY: " + new Date().toISOString().slice(0, 10) + "]" +
      "\n[CURRENT MAP STATE]\n" +
      JSON.stringify(graph || { nodes: [], edges: [] }),
  };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-opus-4-8",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: GRAPH_SYSTEM_PROMPT,
      output_config: {
        format: { type: "json_schema", schema: GRAPH_SCHEMA },
      },
      messages: [...history, lastWithState],
    }),
  });

  const body = await res.json();
  if (!res.ok) {
    const msg = body?.error?.message || `API error ${res.status}`;
    throw Object.assign(new Error(msg), { status: res.status });
  }
  const textBlock = body.content.find((b) => b.type === "text");
  return JSON.parse(textBlock.text);
}

async function nextStep(messages) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-opus-4-8",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: SYSTEM_PROMPT,
      output_config: {
        format: { type: "json_schema", schema: RESPONSE_SCHEMA },
      },
      messages,
    }),
  });

  const body = await res.json();
  if (!res.ok) {
    const msg = body?.error?.message || `API error ${res.status}`;
    throw Object.assign(new Error(msg), { status: res.status });
  }
  const textBlock = body.content.find((b) => b.type === "text");
  return JSON.parse(textBlock.text);
}

function serveStatic(req, res) {
  const urlPath = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  const filePath = path.join(PUBLIC_DIR, path.normalize(urlPath));
  if (!filePath.startsWith(PUBLIC_DIR) || !fs.existsSync(filePath)) {
    res.writeHead(404).end("not found");
    return;
  }
  const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css" };
  res.writeHead(200, { "content-type": types[path.extname(filePath)] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > 1_000_000) reject(new Error("body too large"));
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/api/graph-step") {
    try {
      const { messages, graph } = JSON.parse(await readBody(req));
      if (!Array.isArray(messages) || messages.length === 0) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "messages array required" }));
        return;
      }
      const step = await graphStep(messages, graph);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(step));
    } catch (err) {
      res.writeHead(err.status || 500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }
  if (req.method === "POST" && req.url === "/api/next-step") {
    try {
      const { messages } = JSON.parse(await readBody(req));
      if (!Array.isArray(messages) || messages.length === 0) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "messages array required" }));
        return;
      }
      const step = await nextStep(messages);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(step));
    } catch (err) {
      res.writeHead(err.status || 500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }
  if (req.method === "GET") {
    serveStatic(req, res);
    return;
  }
  res.writeHead(405).end();
});

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn("WARNING: ANTHROPIC_API_KEY is not set — /api/next-step will fail.");
}
server.listen(PORT, () => {
  console.log(`Unstuck running at http://localhost:${PORT}`);
});
