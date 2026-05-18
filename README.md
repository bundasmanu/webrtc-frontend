# webrtc-frontend

Minimal **Vue 3 + TypeScript** SPA using **JsSIP** in the browser to register against a **Kamailio** (or compatible) **WSS** edge, place and receive **WebRTC** audio calls, and try **hold** / **auto-answer**. Built for staging and lab use.

## Features

- SIP **REGISTER** with HTTP digest (handled by JsSIP after `401` challenge).
- Shows **`+sip.instance`** (UUID generated per browser session).
- Clear **registration errors** (wrong credentials, timeouts, SIP status codes).
- **Call**, **accept** / **reject**, **hang up**, **hold** / **unhold**, optional **auto-answer** on incoming calls.
- **ICE** defaults to Google **STUN**; override with JSON (dev env or runtime `config.json`).
- **Docker** image (nginx serves static `dist/` on port **8078**).
- **Helm** chart with optional **ConfigMap**-mounted `config.json` (no image rebuild when changing WSS / ICE).

### SPA pods vs Kamailio WSS

Loading this UI hits **only** your Kubernetes **Ingress/Service** for static files. **SIP signaling** goes **directly** from the browser to **`wss://…` on your edge**. Scaling this Deployment to *N* replicas does **not** affect which Kamailio instance handles SIP; any pod can serve the same JS bundle.

## Local development

Requires **HTTPS** or **localhost** for microphone access (use `npm run dev` on `localhost`).

```bash
cp .env.example .env
# edit VITE_SIP_WSS_URI (and optional ICE JSON)
npm install
npm run dev
```

Build:

```bash
npm run build
npm run preview
```

## Configuration

| Source | Purpose |
|--------|---------|
| `.env` / `VITE_*` | Local `npm run dev` / `npm run build` (overrides defaults in code). |
| `Dockerfile` `ENV VITE_*` | **Static defaults** baked into the production bundle when you build the image (no build-args). |
| `/config.json` | **Runtime** overrides (mounted or served next to `index.html`). Merge order: defaults → `import.meta.env` → `config.json`. |
| GitHub Actions secret `APP_CONFIG_JSON` | **Production** on GitHub Pages: written to `dist/config.json` in CI (see [GitHub Pages](#github-pages)). |

Helm can mount `config.json` from a ConfigMap (see `helm/webrtc-frontend/values.yaml` → `runtimeConfig`).

## GitHub Pages

Static hosting via **GitHub Actions** (see [`.github/workflows/pages.yml`](.github/workflows/pages.yml)).

1. **Repository → Settings → Pages**: set **Source** to **GitHub Actions**.
2. **Secrets → Actions**: add **`APP_CONFIG_JSON`** with the full JSON for production (`sipWssUri`, `iceServers`, `jssipDebug`), same shape as [`docker/local.config.json.example`](docker/local.config.json.example). The workflow writes it to `dist/config.json` after build; invalid JSON fails the job (`jq` validation).
3. **Subpath base URL**: for default **project** sites (`https://<user>.github.io/<repo>/`), the workflow sets `VITE_BASE` to `/<repo>/` automatically. Local `npm run dev` does **not** set this; behavior stays at `/`.
4. **Optional repository variable `VITE_BASE`**: if set (e.g. `/` for a user/org site at the domain root, or a custom path), it overrides the default `/<repo>/` for the Pages build only.

## Docker

The container runs **nginx** and serves the production build on port **8078**. Choose one path:

| Approach | When to use |
|----------|----------------|
| **Docker Compose** | Local testing with **host** networking (nginx on host **:8078**). |
| **`docker` CLI only** | You prefer not to use Compose, or you are scripting `build` / `run` yourself. |

Runtime `config.json` overrides WSS / ICE **without rebuilding** the image (see [Configuration](#configuration)). Your SIP URI (`user@domain`) is always entered in the web UI at login.

### Docker Compose (recommended for local runs)

[`docker-compose.yml`](docker-compose.yml) uses **`network_mode: host`**: nginx listens on the host at **`:8078`** (no published ports). Mounts **[`docker/local.config.json.example`](docker/local.config.json.example)** onto `/usr/share/nginx/html/config.json` (edit that file for WSS / ICE). Works as expected on **Linux**; **Docker Desktop** may handle host networking differently.

```bash
docker compose up --build
```

Open **http://localhost:8078**. Stop with **Ctrl+C** or `docker compose down`.

### Docker CLI (without Compose)

Build once, then run:

```bash
docker build -t webrtc-frontend:latest .
docker run --rm -p 8078:8078 webrtc-frontend:latest
```

That uses only the **defaults baked in** by `Dockerfile` `ENV` (no mounted file).

To apply the **same runtime `config.json`** as Compose (mount the same example file you edit for dev):

```bash
docker build -t webrtc-frontend:latest .
docker run --rm -p 8078:8078 \
  -v "$(pwd)/docker/local.config.json.example:/usr/share/nginx/html/config.json:ro" \
  webrtc-frontend:latest
```

Host networking with the CLI (Linux):

```bash
docker run --rm --network host webrtc-frontend:latest
```

## Helm

```bash
helm upgrade --install webrtc ./helm/webrtc-frontend \
  --set image.repository=your-registry/webrtc-frontend \
  --set image.tag=latest \
  --set runtimeConfig.sipWssUri=wss://edge.example:443 \
  --set ingress.enabled=true \
  --set ingress.hosts[0].host=webrtc.example.com
```

Set `runtimeConfig.iceServers` in `values.yaml` if you need **TURN** (e.g. restrictive NAT).

**DEV only — bypass browser certificate checks for self-signed WSS:**
- macOS Chrome: `open -a "Google Chrome" --args --ignore-certificate-errors --user-data-dir=/tmp/chrome-insecure-dev-profile`
- Linux Chrome/Chromium: `google-chrome --ignore-certificate-errors --user-data-dir=/tmp/chrome-insecure-dev-profile`
- Firefox: create a temporary profile and trust the cert manually; Firefox has no generic `--ignore-certificate-errors` flag.

## Troubleshooting

- **Registration fails**: verify `wss://` URL, TLS certificate trusted by the browser, firewall, and digest credentials/realm on the server.
- **No audio**: allow microphone; some browsers block autoplay until user gesture—click the page once if prompted.
- **ICE / one-way audio**: try adding **TURN** to `iceServers`.

## License

MIT (same stack components: Vue, JsSIP—check their licenses).
