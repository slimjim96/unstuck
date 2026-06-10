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

  window.Unstuck = {
    get theme() { return theme; },
    palette: () => PALETTES[theme],
    onThemeChange: (fn) => listeners.push(fn),
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
