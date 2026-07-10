# Deploy

Dockerized stack: **Go API** + **PostGIS** (Postgres) + **nginx** (React dashboard + API proxy).

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running (or Docker + Docker Compose on a server)
- Git repo cloned locally

## 1. Configure environment

From the **project root**:

```powershell
copy .env.example .env
```

Then edit `.env` and set real values for `JWT_SECRET`, `ADMIN_PASSWORD`, and `POSTGRES_PASSWORD` — the defaults are dev-only and insecure.

## 2. Build and run

```powershell
docker compose up --build -d
```

This starts three services:
- `db` — Postgres + PostGIS, schema auto-applied from `backend/app/database/database.sql` on first run
- `api` — the Go backend
- `web` — the React dashboard (built static files served by nginx, which also reverse-proxies `/api/*`, `/auth/*`, `/health` to `api`)

Open: **http://localhost** (or `http://localhost:$WEB_PORT` if you changed `WEB_PORT`)

Health check: **http://localhost/health**

## 3. Seed data (first run only)

The schema creates tables but only seeds one demo flood zone and one demo dam. The real road network (~16k Ampara road segments) needs importing separately — see `scripts/import_roads.py`. If you're migrating from an existing local dev database instead of starting fresh, restore that volume rather than reseeding.

## 4. Stop

```powershell
docker compose down
```

(Add `-v` to also delete the database volume — don't do this if you want to keep your data.)

---

## Deploy to a VPS (DigitalOcean, Hetzner, etc.)

1. SSH into your server
2. Install Docker + Docker Compose
3. Clone the repo
4. Copy `.env.example` → `.env` and set real secrets (`JWT_SECRET`, `ADMIN_PASSWORD`, `POSTGRES_PASSWORD`)
5. Run:

```bash
docker compose up --build -d
```

6. Open port 80 in firewall (`ufw allow 80`)
7. Visit `http://YOUR_SERVER_IP`
8. Import the road network (`scripts/import_roads.py`) or restore your existing `db_data` volume

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

## Mobile app

The Expo app isn't part of this Docker stack — it's a separate distribution path. Once the backend has a real public URL, point `app/.env`'s `EXPO_PUBLIC_API_URL` at it (instead of a local IP or tunnel) and run/rebuild the app.

---

## Deploy to split cloud services (alternative to a single VPS)

If you'd rather not manage a VPS yourself:

- **Database**: [Supabase](https://supabase.com) or [Neon](https://neon.tech) — both support PostGIS on their free tiers. Run `backend/app/database/database.sql` against it once created, then import roads.
- **API**: [Render](https://render.com) or [Railway](https://railway.app) — deploy `backend/app` as a Dockerfile-based web service. Set env vars: `DATABASE_URL` (from your managed Postgres), `JWT_SECRET`, `ADMIN_PASSWORD`, `APP_ENV=production`.
- **Dashboard**: [Vercel](https://vercel.com) or [Netlify](https://netlify.com) — deploy `dashboard/` as a static site. Build command: `npm run build`, output dir: `build`. Set `REACT_APP_API_URL` to your deployed API's URL (not empty — the nginx same-origin proxy trick only applies to the Docker path).

**Recommended for most cases:** a single VPS with `docker compose` — one command, one URL, no juggling three separate platforms.

---

## Architecture (Docker)

```
Browser → nginx:80 (web)
            ├── /          → React static files (dashboard/)
            ├── /api/*     → proxy → api:8080
            ├── /auth/*    → proxy → api:8080
            └── /health    → proxy → api:8080
                                  ↓
                             api:8080 → db:5432 (PostGIS)
```

Dashboard uses **same-origin** API calls in Docker (no CORS issues) — `REACT_APP_API_URL` is built as an empty string, so `config.js`'s `BASE_URL` becomes `""` and every fetch is a relative path nginx proxies through.

---

## Demo credentials

Set in `.env`:

| Variable | Default (dev — change before going live) |
|----------|----------------|
| `ADMIN_USERNAME` | `admin` |
| `ADMIN_PASSWORD` | `admin123` |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Port 80 in use | Set `WEB_PORT=8081` in `.env` |
| `Cannot reach API` in UI | Ensure `docker compose ps` shows both `api` and `web` healthy |
| Admin login fails | Check `ADMIN_USERNAME` / `ADMIN_PASSWORD` in `.env`, restart: `docker compose up -d --force-recreate` |
| Local dev without Docker | `cd backend/app && go run ./cmd/api` (needs local Postgres/PostGIS) + `cd dashboard && npm start` |
| Flood zones / dam alerts don't block roads on a fresh deploy | Confirm the road network was actually imported (`scripts/import_roads.py`) — an empty `road_segments` table means there's nothing to block |
