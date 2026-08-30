# Deploying the Gather instrument renderer alongside ODK Central

This directory provides a turnkey, version-controlled deployment that serves the
Gather instrument renderer at `renderer.openfieldworks.com` **and** keeps an
existing ODK Central instance at `central.openfieldworks.com` — both on one
server sharing a single public IP and ports 80/443.

## Why a reverse proxy is required

DNS maps a hostname to an IP address only; it has no notion of ports. Both
subdomains resolve to the same server and arrive on port 443. Only one process
can bind 443, so a reverse proxy (Caddy) terminates TLS on 80/443 and routes by
hostname to each app's plain-HTTP upstream:

```
DNS:  renderer.openfieldworks.com ─┐
      central.openfieldworks.com  ─┴─► server IP  (:80, :443)
                                          │
                                    ┌─────▼──────┐
                                    │   Caddy    │  owns 80/443, per-host Let's Encrypt certs
                                    └──┬──────┬──┘
                     Host: renderer.…  │      │  Host: central.…
                                       ▼      ▼
                    127.0.0.1:8080 (renderer)   127.0.0.1:8081 (ODK Central nginx, HTTP)
```

ODK Central's bundled nginx normally owns 80/443 and manages its own certs. We
switch it to its supported **`SSL_TYPE=upstream`** mode, in which it serves plain
HTTP and expects an upstream proxy to handle TLS. Caddy then manages certificates
for both hostnames.

## Files

| File | Purpose |
| --- | --- |
| `docker-compose.yml` | Builds/runs the renderer container and a host-network Caddy proxy. |
| `Caddyfile` | Routes both hostnames to their loopback upstreams; enables auto-HTTPS. |
| `.env.example` | Template for hostnames, upstream ports, and ACME email. |
| `central/docker-compose.override.yml` | Rebinds ODK Central's nginx to `127.0.0.1:8081` (HTTP only). |

## Prerequisites

- Docker + Docker Compose v2.24.4+ (`docker compose version`).
- Firewall allows inbound **80** and **443** (80 is required for the ACME HTTP
  challenge).
- Read access to this repo on the server (SSH deploy key or HTTPS token).

## One-time setup

### 1. DNS

Add an A record `renderer.openfieldworks.com` → the server's public IP (mirror
AAAA if you use IPv6). `central.openfieldworks.com` already resolves here.

### 2. Reconfigure ODK Central to run behind the proxy

In your **ODK Central** install directory:

1. Edit Central's `.env`:
   ```dotenv
   SSL_TYPE=upstream
   # Keep HTTPS_PORT=443 — Central uses it to build public URLs, and 443 is the
   # public port Caddy serves. Do NOT set it to 8081.
   HTTPS_PORT=443
   ```
2. Copy the override so Central's nginx only publishes HTTP on loopback:
   ```bash
   cp /path/to/this/repo/deploy/central/docker-compose.override.yml \
      ./docker-compose.override.yml
   ```
3. Recreate Central so its nginx releases 80/443:
   ```bash
   docker compose up -d
   ```
4. Verify Central now answers plain HTTP on loopback:
   ```bash
   curl -sI -H 'Host: central.openfieldworks.com' http://127.0.0.1:8081/ | head -n1
   ```

> Central's Let's Encrypt certs become unused after this — Caddy takes over
> certificate management for both hostnames.

### 3. Configure and start the renderer + proxy

From this `deploy/` directory:

```bash
cp .env.example .env
# edit .env: set the two domains and ACME_EMAIL
docker compose up -d --build
```

This builds the renderer image (from the repo root context) and starts Caddy on
80/443. Caddy provisions Let's Encrypt certificates for both hostnames on first
request.

### Ordering

Complete step 2 (Central releases 443) **before** step 3 (Caddy binds 443), or
Caddy cannot start.

## Verify

```bash
# Renderer upstream (local):
curl -sI http://127.0.0.1:8080/ | head -n1                      # 200 OK

# Public HTTPS via Caddy:
curl -sI https://renderer.openfieldworks.com/ | head -n1        # 200 OK
curl -sI https://central.openfieldworks.com/ | head -n1         # 200/302

# Framing policy intact for hosted Composer:
curl -s -o /dev/null -w '%{http_code}\n' https://renderer.openfieldworks.com/
curl -sI https://renderer.openfieldworks.com/ | grep -i content-security-policy
```

The renderer response must include
`Content-Security-Policy: ... frame-ancestors https://a2ui-project.github.io`
and must **not** include an `X-Frame-Options` header, so the hosted Composer at
`https://a2ui-project.github.io/composer/` can embed it.

## Updating the renderer

```bash
git pull
cd deploy
docker compose up -d --build renderer
```

## Rolling back Central to standalone TLS

1. Remove `docker-compose.override.yml` from Central's directory.
2. Set `SSL_TYPE=letsencrypt` (and `HTTP_PORT=80`, `HTTPS_PORT=443`) in Central's `.env`.
3. Stop this stack (`docker compose down` here) so Caddy frees 80/443.
4. `docker compose up -d` in Central's directory.

## Notes

- Caddy runs with `network_mode: host` (Linux) so it can bind 80/443 and reach
  both loopback upstreams without exposing them publicly. The renderer is
  published only on `127.0.0.1`.
- Do not add `X-Frame-Options` at the proxy; it would break Composer embedding.
- Serve the renderer at the subdomain **root** (as configured) — its assets are
  referenced from `/assets/...` and would 404 under a subpath.
