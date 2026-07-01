# Deploy — Demo MVP (Option A)

Dockerized stack: **Go API** + **nginx** (React UI + API proxy).

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- Git repo cloned locally

## 1. Configure environment

From the **project root**:

```powershell
copy .env.example .env
```

Edit `.env` and change at minimum:

```env
JWT_SECRET=your-long-random-secret-here
ADMIN_PASSWORD=your-secure-admin-password
```

`ADMIN_USERNAME` defaults to `admin`.

## 2. Build and run

```powershell
docker compose up --build -d
```

Open: **http://localhost** (or `http://localhost:WEB_PORT` if you changed `WEB_PORT`)

Health check: **http://localhost/health**

## 3. Stop

```powershell
docker compose down
```

---

## Deploy to a VPS (DigitalOcean, Hetzner, etc.)

1. SSH into your server
2. Install Docker + Docker Compose
3. Clone the repo
4. Copy `.env.example` → `.env` and set secrets
5. Run:

```bash
docker compose up --build -d
```

6. Open port 80 in firewall (`ufw allow 80`)
7. Visit `http://YOUR_SERVER_IP`

### Optional: HTTPS with Caddy (recommended)

Install [Caddy](https://caddyserver.com/) in front of Docker on port 80, or map Docker to another port and let Caddy proxy:

```
yourdomain.com {
    reverse_proxy localhost:80
}
```

Update `.env`:

```env
CORS_ORIGIN=https://yourdomain.com
```

---

## Deploy to Railway

1. Push repo to GitHub
2. Create new **Railway** project → **Deploy from GitHub**
3. Add **two services** from the same repo, or use Docker Compose plugin if available

**Simpler Railway approach — API only:**

- Deploy `backend/app` as a Dockerfile service
- Set env vars: `JWT_SECRET`, `ADMIN_PASSWORD`, `APP_ENV=production`
- Deploy `frontend` separately as static site (build command: `npm run build`, output: `dist`)
- Set `VITE_API_URL` to your Railway API URL when building frontend

**Recommended for demo:** use a single VPS with `docker compose` — one command, one URL.

---

## Architecture (Docker)

```
Browser → nginx:80 (web)
            ├── /          → React static files
            ├── /api/*     → proxy → api:8080
            ├── /auth/*    → proxy → api:8080
            └── /health    → proxy → api:8080
```

Frontend uses **same-origin** API calls in Docker (no CORS issues).

---

## Demo credentials

Set in `.env`:

| Variable | Default (dev) |
|----------|----------------|
| `ADMIN_USERNAME` | `admin` |
| `ADMIN_PASSWORD` | `admin123` (change in `.env`!) |

---

## Limitations (demo MVP)

- Reports stored **in memory** — lost on API restart
- Demo road network around Ampara (not full PostGIS)
- For production: add PostgreSQL + persistent repos (Option B)

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Port 80 in use | Set `WEB_PORT=8081` in `.env` |
| `Cannot reach API` in UI | Ensure `docker compose ps` shows both `api` and `web` healthy |
| Admin login fails | Check `ADMIN_USERNAME` / `ADMIN_PASSWORD` in `.env`, restart: `docker compose up -d --force-recreate` |
| Local dev still works | `cd backend/app && go run ./cmd/api` + `cd frontend && npm run build && npx serve dist -l 3000` |
