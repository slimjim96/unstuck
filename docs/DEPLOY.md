# Deploying Unstuck (personal tool)

One user, several devices. Three paths, easiest first. All of them use
the same three environment variables:

| Var | Meaning | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude API key (required for the AI) | — |
| `UNSTUCK_TOKEN` | shared access token; when set, every `/api/*` call requires it. Leave unset on localhost. | unset (open) |
| `UNSTUCK_DATA` | where `graph.json` + `events.ndjson` live | `./data` |
| `PORT` | listen port | `3456` |

The first time a browser hits a token-protected server, the page asks
for the token once and remembers it (localStorage). On a phone, open
the site in the browser → "Add to Home Screen" — the PWA manifest makes
it install like an app (Focus is the start screen: one tiny step).

## Option A — Tailscale (recommended: no public exposure at all)

Install [Tailscale](https://tailscale.com) on the PC that runs the
server and on your phone (free for personal use). Then just run the
server as you already do:

```powershell
node server.js
```

On the phone, open `http://<your-pc-tailscale-name>:3456`. Done — the
traffic never leaves your tailnet, so `UNSTUCK_TOKEN` is optional
(set it anyway if other people share the tailnet).

To keep it running across reboots, register a Scheduled Task:

```powershell
schtasks /create /tn Unstuck /sc onlogon /tr "node C:\projects\_claude-projects\todo-new\server.js"
```

## Option B — a small VPS (public internet → set the token!)

```bash
# on the VPS (Node 22+; no npm install — zero dependencies)
git clone https://github.com/slimjim96/unstuck && cd unstuck
ANTHROPIC_API_KEY=sk-... UNSTUCK_TOKEN=<long-random-string> node server.js
```

systemd unit (`/etc/systemd/system/unstuck.service`):

```ini
[Unit]
Description=Unstuck
After=network.target

[Service]
WorkingDirectory=/opt/unstuck
ExecStart=/usr/bin/node server.js
Environment=ANTHROPIC_API_KEY=sk-...
Environment=UNSTUCK_TOKEN=change-me-long-and-random
Environment=UNSTUCK_DATA=/var/lib/unstuck
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Put a TLS proxy (Caddy is two lines) in front — the token travels in
headers, so HTTPS is non-negotiable on the public internet:

```
unstuck.example.com {
    reverse_proxy localhost:3456
}
```

## Option C — fly.io (uses the repo Dockerfile)

```bash
fly launch --no-deploy          # accepts the Dockerfile; pick a region
fly volumes create unstuck_data --size 1
# add to fly.toml:
#   [mounts]
#     source = "unstuck_data"
#     destination = "/app/data"
fly secrets set ANTHROPIC_API_KEY=sk-... UNSTUCK_TOKEN=<long-random-string>
fly deploy
```

## Moving your existing map

The graph lives in `data/` next to `server.js` (or `UNSTUCK_DATA`).
To move machines, copy that directory — it's two small files. The
browser-localStorage migration only applies to pre-Phase-2 maps.

## Notes

- SSE keeps all devices live-synced; no extra setup.
- API cost control is your Anthropic console spend cap — the token
  keeps strangers from spending your budget.
- Rotate `UNSTUCK_TOKEN` by changing the env var and re-entering it on
  each device when prompted.
