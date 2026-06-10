// Generates the sample maps in public/samples/ by running three
// domain-diverse prompts through the real /api/graph-step engine.
// Usage: start the server (with ANTHROPIC_API_KEY), then:
//   node scripts/generate-samples.mjs
// Re-run whenever the system prompt changes — samples are model output.

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const SERVER = process.env.UNSTUCK_URL || "http://localhost:3456";
const OUT = path.join(import.meta.dirname, "..", "public", "samples");

const DOMAINS = [
  {
    file: "learn-ai",
    name: "Learning AI/ML",
    turns: [
      "I'm a developer and I want to get into AI/ML engineering, but the field feels enormous — papers, math, frameworks, agents — and I never actually start.",
      "Go one level deeper: split each big area you created into concrete first steps, and add blocking dependencies where one genuinely needs to come before another.",
    ],
  },
  {
    file: "ship-app",
    name: "Shipping a side project",
    turns: [
      "I've been meaning to build and ship a small web app side project for over a year. It never gets past the ideas note on my phone.",
      "Split the biggest remaining chunks smaller, and mark anything that's calendar-bound as time-based.",
    ],
  },
  {
    file: "build-shed",
    name: "Building a shed",
    turns: [
      "I want to build a storage shed in my backyard this summer. Permits, the concrete slab, materials, framing — it overwhelms me every time I think about it.",
      "Go one level deeper on the foundation and framing parts, and add the real blocking dependencies between phases (permit before slab, slab before framing, and so on).",
    ],
  },
];

// Mirror of the Map's applyOps, against a plain {nodes, edges} snapshot.
function applyOps(graph, ops) {
  for (const o of ops) {
    if (o.op === "add_node" && o.id && !graph.nodes.some((n) => n.id === o.id)) {
      graph.nodes.push({
        id: o.id, label: o.label || o.id, type: o.type || "task",
        mode: o.mode || "step", minutes: o.minutes, when: o.when,
        detail: o.detail, status: o.status || "open",
      });
    } else if (o.op === "update_node") {
      const n = graph.nodes.find((x) => x.id === o.id);
      if (n) for (const k of ["label","type","mode","minutes","when","detail","status"])
        if (o[k] !== undefined) n[k] = o[k];
    } else if (o.op === "remove_node") {
      graph.nodes = graph.nodes.filter((n) => n.id !== o.id);
      graph.edges = graph.edges.filter((e) => e.source !== o.id && e.target !== o.id);
    } else if (o.op === "add_edge" &&
        graph.nodes.some((n) => n.id === o.source) &&
        graph.nodes.some((n) => n.id === o.target) &&
        !graph.edges.some((e) => e.source === o.source && e.target === o.target && e.kind === (o.kind || "part_of"))) {
      graph.edges.push({ source: o.source, target: o.target, kind: o.kind || "part_of" });
    } else if (o.op === "remove_edge") {
      graph.edges = graph.edges.filter((e) => !(e.source === o.source && e.target === o.target));
    }
  }
}

await mkdir(OUT, { recursive: true });

for (const domain of DOMAINS) {
  console.log(`\n=== ${domain.name} ===`);
  const messages = [];
  const graph = { nodes: [], edges: [] };

  for (const turn of domain.turns) {
    messages.push({ role: "user", content: turn });
    const res = await fetch(`${SERVER}/api/graph-step`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages, graph }),
    });
    const out = await res.json();
    if (!res.ok) throw new Error(`${domain.file}: ${out.error}`);
    messages.push({ role: "assistant", content: out.reply });
    applyOps(graph, out.operations || []);
    console.log(`  turn ok — ${out.operations.length} ops → ${graph.nodes.length} nodes, ${graph.edges.length} edges`);
  }

  const file = path.join(OUT, `${domain.file}.json`);
  await writeFile(file, JSON.stringify({ name: domain.name, graph }, null, 2));
  console.log(`  wrote ${file}`);
}

console.log("\nAll samples generated.");
