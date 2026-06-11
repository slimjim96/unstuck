# Deploying Unstuck (personal tool)

One user, several devices. Paths in order of effort — A (home LAN) is
the right first step; C covers a Linux/CentOS box including shared
hosting with a Node app runner. All of them use the same environment
variables:

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

## Option A — your own PC on the home network (start here)

The server already listens on all interfaces. Two steps:

1. **Open the Windows firewall once** (elevated PowerShell — right-click
   PowerShell → Run as administrator):

   ```powershell
   New-NetFirewallRule -DisplayName "Unstuck" -Direction Inbound `
     -Protocol TCP -LocalPort 3456 -Profile Private -Action Allow
   ```

   `-Profile Private` keeps it home-Wi-Fi only (no effect on public
   networks). Remove later with
   `Remove-NetFirewallRule -DisplayName "Unstuck"`.

2. Run the server as usual, then on the phone (same Wi-Fi) open
   `http://<your-pc-ip>:3456` (find the IP with `ipconfig`) → browser
   menu → **Add to Home Screen**.

Setting `UNSTUCK_TOKEN` is optional on a home network you trust, but
costs nothing — anyone on the Wi-Fi can otherwise read/write the map
and spend API tokens.

To start the server automatically at logon:

```powershell
schtasks /create /tn Unstuck /sc onlogon `
  /tr "node C:\projects\_claude-projects\todo-new\server.js"
```

Caveat: the phone can only reach the map while the PC is on, and your
PC's IP may change (give it a DHCP reservation in the router, or use
Option B).

## Option B — Tailscale (same idea, works away from home too)

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

## Option C — Linux/CentOS server (public internet → set the token!)

Install Node 22+ first. On CentOS / Rocky / Alma:

```bash
sudo dnf module install nodejs:22        # or NodeSource if the module
                                         # stream isn't available
node --version                           # expect v22+
```

Then (no npm install — zero dependencies):

```bash
git clone https://github.com/slimjim96/unstuck && cd unstuck
ANTHROPIC_API_KEY=sk-... UNSTUCK_TOKEN=<long-random-string> node server.js
```

CentOS specifics:

- **firewalld**: `sudo firewall-cmd --permanent --add-port=3456/tcp && sudo firewall-cmd --reload`
  (skip if a reverse proxy on 443 is the only public door — preferred).
- **SELinux**: if a reverse proxy (nginx/Apache/Caddy) fronts the app,
  allow it to talk to the backend:
  `sudo setsebool -P httpd_can_network_connect 1`.

### Shared hosting (cPanel "Setup Node.js App" / Passenger)

Classic shared hosting works only if the host offers a Node.js app
runner (CloudLinux + Passenger — common on cPanel). If yours does:

1. cPanel → **Setup Node.js App** → Node 22.x, application root =
   the repo, **startup file = `server.js`**.
2. Add `ANTHROPIC_API_KEY`, `UNSTUCK_TOKEN`, and
   `UNSTUCK_DATA=/home/<user>/unstuck-data` (somewhere OUTSIDE the
   web-served directory) in the app's environment variables UI.
3. The host's proxy terminates TLS for you. SSE: the server already
   sends `x-accel-buffering: no`, which stops nginx-style proxies from
   buffering the event stream — if live-sync still stalls, the lenses
   degrade gracefully (refresh shows current state) but ask the host
   about proxy buffering.
4. No Node app runner on the plan = this won't work; a $4 VPS
   (Option C above) is the fallback.

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

## Option D — fly.io (uses the repo Dockerfile)

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
