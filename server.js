// Unstuck server — zero npm dependencies (Node 22 natives only).
// Owns the canonical graph (data/graph.json + append-only data/events.ndjson),
// exposes it via GET /api/graph, POST /api/ops (the single write path for
// user and AI alike), PUT /api/graph (wholesale replace: migration, samples,
// clear), GET /api/events (SSE live-sync), and proxies POST /api/graph-step
// to the Claude API. Requires ANTHROPIC_API_KEY in the environment.

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = process.env.PORT || 3456;
const PUBLIC_DIR = path.join(__dirname, "public");

// ---- canonical graph store -------------------------------------------------
// Shape: cytoscape element JSON ({ group, data, position }) — exactly what
// the lenses render, positions included (the user's arrangement is truth).

const DATA_DIR = path.join(__dirname, "data");
const GRAPH_FILE = path.join(DATA_DIR, "graph.json");
const EVENTS_FILE = path.join(DATA_DIR, "events.ndjson");
fs.mkdirSync(DATA_DIR, { recursive: true });

let graph = { rev: 0, elements: [] };
try {
  const loaded = JSON.parse(fs.readFileSync(GRAPH_FILE, "utf8"));
  if (Number.isInteger(loaded.rev) && Array.isArray(loaded.elements)) graph = loaded;
} catch (e) {
  if (e.code !== "ENOENT") console.warn("graph.json unreadable, starting empty:", e.message);
}

function saveGraph() {
  const tmp = GRAPH_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(graph));
  fs.renameSync(tmp, GRAPH_FILE); // atomic on the same volume
}

const NODE_FIELDS = ["label", "type", "mode", "minutes", "when", "detail", "status"];

function findNode(id) {
  return graph.elements.find((e) => e.data && e.data.id === id && !e.data.source);
}

// The single place timestamps are stamped. Clients send ops; the model's
// proposed ops are forwarded by the client through the same door.
function applyOps(ops) {
  const now = new Date().toISOString();
  for (const o of ops) {
    if (o.op === "add_node" && o.id && !findNode(o.id)) {
      graph.elements.push({
        group: "nodes",
        data: { id: o.id, label: o.label || o.id, type: o.type || "task", mode: o.mode || "step",
                minutes: o.minutes, when: o.when, detail: o.detail, status: o.status || "open",
                createdAt: now, touchedAt: now },
        position: { x: typeof o.x === "number" ? o.x : 0, y: typeof o.y === "number" ? o.y : 0 },
      });
    } else if (o.op === "update_node") {
      const n = findNode(o.id);
      if (!n) continue;
      for (const k of NODE_FIELDS) {
        if (o[k] === null) delete n.data[k]; // explicit clear (client-only; the model schema has no nulls)
        else if (o[k] !== undefined) n.data[k] = o[k];
      }
      n.data.touchedAt = now;
      if (o.status === "done") n.data.doneAt = now;
      else if (o.status === "open") delete n.data.doneAt;
    } else if (o.op === "move_node") {
      const n = findNode(o.id);
      // arrangement, not engagement: moves never bump touchedAt
      if (n && typeof o.x === "number" && typeof o.y === "number") n.position = { x: o.x, y: o.y };
    } else if (o.op === "remove_node") {
      graph.elements = graph.elements.filter((e) => {
        const d = e.data || {};
        return d.id !== o.id && d.source !== o.id && d.target !== o.id;
      });
    } else if (o.op === "add_edge" && findNode(o.source) && findNode(o.target)) {
      const eid = o.source + "->" + o.target + ":" + (o.kind || "part_of");
      if (!graph.elements.some((e) => e.data && e.data.id === eid))
        graph.elements.push({ group: "edges",
          data: { id: eid, source: o.source, target: o.target, kind: o.kind || "part_of" } });
    } else if (o.op === "remove_edge") {
      graph.elements = graph.elements.filter((e) => {
        const d = e.data || {};
        return !(d.source === o.source && d.target === o.target);
      });
    }
  }
}

// ---- SSE live-sync ----------------------------------------------------------
const sseClients = new Set();

function broadcast(event) {
  const line = "data: " + JSON.stringify(event) + "\n\n";
  for (const res of sseClients) res.write(line);
}

function commit(entry) {
  graph.rev += 1;
  saveGraph();
  fs.appendFileSync(EVENTS_FILE,
    JSON.stringify({ t: new Date().toISOString(), rev: graph.rev, ...entry }) + "\n");
  broadcast({ rev: graph.rev, ...entry });
}

// day-precision view of the graph for the model (cheap tokens, enough signal)
function snapshotForModel() {
  const day = (iso) => (iso ? iso.slice(0, 10) : undefined);
  const nodes = [], edges = [];
  for (const e of graph.elements) {
    const d = e.data || {};
    if (d.source && d.target) edges.push({ source: d.source, target: d.target, kind: d.kind || "part_of" });
    else if (d.id) nodes.push({ id: d.id, label: d.label, type: d.type, mode: d.mode,
      minutes: d.minutes, when: d.when, detail: d.detail, status: d.status || "open",
      created: day(d.createdAt), touched: day(d.touchedAt), done: day(d.doneAt) });
  }
  return { nodes, edges };
}

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

async function graphStep(messages) {
  // Inject the current map state (the server-canonical graph, including the
  // user's manual edits) into the final user turn so the model never fights
  // the user's arrangement.
  const history = messages.slice(0, -1);
  const last = messages[messages.length - 1];
  const lastWithState = {
    role: "user",
    content:
      last.content +
      "\n\n[TODAY: " + new Date().toISOString().slice(0, 10) + "]" +
      "\n[CURRENT MAP STATE]\n" +
      JSON.stringify(snapshotForModel()),
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

function json(res, code, body) {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  const url = req.url.split("?")[0];

  if (req.method === "GET" && url === "/api/graph") {
    json(res, 200, { rev: graph.rev, elements: graph.elements });
    return;
  }

  if (req.method === "POST" && url === "/api/ops") {
    try {
      const { ops, client } = JSON.parse(await readBody(req));
      if (!Array.isArray(ops) || !ops.every((o) => o && typeof o.op === "string")) {
        json(res, 400, { error: "ops array required" });
        return;
      }
      applyOps(ops);
      commit({ type: "ops", client, ops });
      json(res, 200, { rev: graph.rev });
    } catch (err) {
      json(res, 500, { error: err.message });
    }
    return;
  }

  if (req.method === "PUT" && url === "/api/graph") {
    try {
      const { elements, client } = JSON.parse(await readBody(req));
      if (!Array.isArray(elements)) {
        json(res, 400, { error: "elements array required" });
        return;
      }
      const now = new Date().toISOString();
      for (const e of elements) {
        const d = e.data || {};
        if (d.id && !d.source) {
          d.status = d.status || "open";
          d.createdAt = d.createdAt || now;
          d.touchedAt = d.touchedAt || now;
        }
      }
      graph.elements = elements;
      commit({ type: "replace", client, count: elements.length });
      json(res, 200, { rev: graph.rev });
    } catch (err) {
      json(res, 500, { error: err.message });
    }
    return;
  }

  if (req.method === "GET" && url === "/api/events") {
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      "connection": "keep-alive",
    });
    res.write("data: " + JSON.stringify({ type: "hello", rev: graph.rev }) + "\n\n");
    sseClients.add(res);
    const ping = setInterval(() => res.write(": ping\n\n"), 25000);
    req.on("close", () => { clearInterval(ping); sseClients.delete(res); });
    return;
  }

  if (req.method === "POST" && url === "/api/graph-step") {
    try {
      const { messages } = JSON.parse(await readBody(req));
      if (!Array.isArray(messages) || messages.length === 0) {
        json(res, 400, { error: "messages array required" });
        return;
      }
      const step = await graphStep(messages);
      json(res, 200, step);
    } catch (err) {
      json(res, err.status || 500, { error: err.message });
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
  console.warn("WARNING: ANTHROPIC_API_KEY is not set — /api/graph-step will fail.");
}
server.listen(PORT, () => {
  console.log(`Unstuck running at http://localhost:${PORT}`);
});
