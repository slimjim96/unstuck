// Unstuck shared runtime: theme (applied pre-paint — load this synchronously
// in <head>), the shared color palette for canvas-drawn views, and the nav
// injected into any <nav data-nav> placeholder.
(() => {
  // canvas views (cytoscape / WebGL / SVG) can't read CSS vars cheaply, so
  // the same colors live here; keep in sync with app.css
  const PALETTES = {
    dark: {
      bg: "#10141a", panel: "#161c24", card: "#1a212b", ink: "#e8ecf1",
      muted: "#8b97a5", line: "#2a3442", accent: "#4fc3a1",
      step: "#4fc3a1", time: "#d9a05b", mixed: "#9d8cff", stuck: "#d97b7b",
      plain: "#5a6b7d", done: "#3a4756", edge: "#3a4756", related: "#2f3a48",
      labelDone: "#8b97a5",
    },
    light: {
      bg: "#eef2f5", panel: "#f7f9fb", card: "#ffffff", ink: "#1c2733",
      muted: "#5f6e7d", line: "#d4dde4", accent: "#1f9d7e",
      step: "#1f9d7e", time: "#b87b2e", mixed: "#7263d2", stuck: "#c45c5c",
      plain: "#8595a5", done: "#c2ccd6", edge: "#b7c2cc", related: "#cdd8e0",
      labelDone: "#8595a5",
    },
  };

  let theme = localStorage.getItem("unstuck.theme") || "dark";
  document.documentElement.classList.toggle("light", theme === "light");

  const listeners = [];
  function setTheme(t, persist = true) {
    theme = t;
    if (persist) localStorage.setItem("unstuck.theme", t);
    document.documentElement.classList.toggle("light", t === "light");
    const btn = document.getElementById("theme");
    if (btn) btn.textContent = t === "light" ? "Dark" : "Light";
    for (const fn of listeners) fn(t);
  }

  // ---- the shared graph: server-canonical since Phase 2 --------------------
  // localStorage's old unstuck.graph is read once as a migration source.
  const clientId = Math.random().toString(36).slice(2, 10);

  // Deployed servers may require a shared token (Phase 3 / UNSTUCK_TOKEN).
  // On 401 we ask once, remember it, and retry.
  let token = localStorage.getItem("unstuck.token") || "";

  async function api(path, opts = {}) {
    opts.headers = Object.assign({}, opts.headers,
      token ? { "x-unstuck-token": token } : {});
    let res = await fetch(path, opts);
    if (res.status === 401) {
      const t = prompt("This Unstuck server asks for its access token:");
      if (t && t.trim()) {
        token = t.trim();
        localStorage.setItem("unstuck.token", token);
        opts.headers["x-unstuck-token"] = token;
        res = await fetch(path, opts);
      }
    }
    return res;
  }

  async function replaceGraph(elements) {
    await api("/api/graph", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ elements, client: clientId }),
    });
  }

  async function loadGraph() {
    const res = await api("/api/graph");
    if (!res.ok) throw new Error("couldn't load the graph from the server");
    let elements = (await res.json()).elements || [];
    if (!elements.length && !localStorage.getItem("unstuck.migrated")) {
      const legacy = JSON.parse(localStorage.getItem("unstuck.graph") || "[]");
      if (legacy.length) {
        await replaceGraph(legacy);
        elements = legacy;
      }
    }
    localStorage.setItem("unstuck.migrated", "1");
    graphReady = true;
    connectEvents();
    return elements;
  }

  async function sendOps(ops) {
    if (!ops || !ops.length) return;
    await api("/api/ops", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ops, client: clientId }),
    });
  }

  // SSE: fires for changes made by OTHER clients (own ops are applied
  // locally). EventSource can't send headers, so the token rides the query
  // string; we connect only after the first authorized load so the token
  // prompt (if any) has already happened.
  const changeFns = [];
  let es = null, graphReady = false;
  function connectEvents() {
    if (es || !changeFns.length || !graphReady) return;
    es = new EventSource("/api/events" + (token ? "?token=" + encodeURIComponent(token) : ""));
    es.onmessage = (e) => {
      const ev = JSON.parse(e.data);
      if (ev.type !== "hello" && ev.client !== clientId)
        for (const fn of changeFns) fn(ev);
    };
  }
  function onGraphChange(fn) {
    changeFns.push(fn);
    connectEvents();
  }

  window.Unstuck = {
    get theme() { return theme; },
    palette: () => PALETTES[theme],
    onThemeChange: (fn) => listeners.push(fn),
    clientId, api, loadGraph, sendOps, replaceGraph, onGraphChange,
  };

  const NAV = [
    ["/", "Map"],
    ["/focus.html", "Focus"],
    ["/space.html", "Space (3D)"],
    ["/timeline.html", "Timeline"],
    ["/trail.html", "Trail"],
  ];

  document.addEventListener("DOMContentLoaded", () => {
    const nav = document.querySelector("[data-nav]");
    if (nav) {
      const here = location.pathname;
      for (const [href, label] of NAV) {
        if (href === here || (href === "/" && here === "/index.html")) continue;
        const a = document.createElement("a");
        a.href = href;
        a.textContent = label;
        nav.appendChild(a);
      }
      const btn = document.createElement("button");
      btn.id = "theme";
      btn.textContent = theme === "light" ? "Dark" : "Light";
      btn.addEventListener("click", () => setTheme(theme === "light" ? "dark" : "light"));
      nav.appendChild(btn);
    }
    // theme follows other tabs; graph sync stays page-specific
    window.addEventListener("storage", (e) => {
      if (e.key === "unstuck.theme" && e.newValue && e.newValue !== theme)
        setTheme(e.newValue, false);
    });
  });
})();
