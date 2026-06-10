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
      description: "When kind=question: the default answer used if the user doesn't know. Empty string otherwise.",
    },
    not_today: {
      type: "string",
      description: "The scary part explicitly forbidden today (e.g. 'You are NOT calling today'), or empty string.",
    },
  },
  required: ["kind", "text", "default", "not_today"],
  additionalProperties: false,
};

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
