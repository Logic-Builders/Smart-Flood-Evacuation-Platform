# Smart Flood Evacuation Platform

A full-stack system that routes people around flood risk in real time instead of just finding the shortest path — built by **Logic Builders** as our first full-stack project, as a semester project, for Ampara, Sri Lanka.

Rainfall, dam water levels, admin-declared flood zones, and citizen hazard reports are combined into a live risk layer over a real road network (~16k Ampara road segments). Risky or blocked roads get penalized or removed from the graph, and A* returns the safest path between two points — not necessarily the fastest one.

## Repository structure

```
Smart-Flood-Evacuation-Platform/
│
├── backend/app/                     Go API (clean architecture)
│   ├── cmd/api/main.go              Entry point — wiring, routes, server start
│   ├── config/config.go             Env-based config
│   ├── database/database.sql        Postgres/PostGIS schema
│   ├── internal/
│   │   ├── domain/                  Core entities: RoadSegment, FloodZone, Dam, HazardReport, User, Weather
│   │   ├── application/             Use-case/service layer
│   │   │   ├── routing/             RoutingService + RiskEvaluator — builds the graph, runs A*
│   │   │   ├── reports/             Hazard report submission + admin approve/reject workflow
│   │   │   ├── floodzones/          Flood zone CRUD, blocks/penalizes roads inside a zone
│   │   │   ├── dams/                Dam water levels + downstream road alerts
│   │   │   ├── weather/             Rainfall/weather data ingestion
│   │   │   └── floodhub/            Optional Google Flood Hub gauge poller (predictive zones)
│   │   ├── infrastructure/
│   │   │   ├── repositories/postgres/   PostGIS-backed repositories
│   │   │   └── external/                Flood data adapters (mock + Google Flood Hub)
│   │   └── interfaces/
│   │       ├── http/handlers/       Gin route handlers
│   │       ├── http/middleware/     JWT auth, CORS
│   │       └── dto/                 Request/response DTOs
│   ├── pkg/
│   │   ├── graph/                   Generic graph + A* implementation
│   │   ├── geo/                     Haversine distance, etc.
│   │   └── jwt/                     Token issue/verify
│   └── Dockerfile
│
├── frontend/                        Public web app (React + Vite) — plan a route, submit a hazard report
│   └── src/ (App.jsx, api.js, main.jsx)
│
├── dashboard/                       Admin dashboard (React) — authorities review reports & monitor conditions
│   └── src/
│       ├── context/                 Auth + Toast state
│       └── components/
│           ├── Auth/                Login screen
│           ├── Layout/              Topbar, Sidebar
│           ├── Pages/                Overview, Reports, Weather, Dams, Map, System
│           └── UI/                   Button, Card, Badge, Toast
│
├── app/                             Mobile app (React Native + Expo)
│   └── app/
│       ├── (tabs)/                  index, map, report
│       └── components/
│
├── scripts/                         import_roads.py + SQL migrations (real Ampara road network import)
├── docker-compose.yml                db (PostGIS) + api (Go) + web (dashboard, served via nginx)
├── .env.example
├── DEPLOY.md                        Docker/VPS deployment guide
├── MVP-RUN.md                       Run everything locally without Docker
└── README.md
```

## System flow

```
Rainfall Data ─────────┐
Dam Water Level ───────┼──▶ Risk Evaluator ──▶ Combine Risk Layers
User Hazard Reports ────┤                              │
Flood Hub Gauges (opt.) ┘                              ▼
                                          Modify Graph Edge Weights
                                       (block flooded roads, penalize risky ones)
                                                        │
                                                        ▼
                                                     Run A*
                                                        │
                                                        ▼
                                              Return Safest Route
```

## Tech stack

| Layer | Tech |
|---|---|
| Backend API | Go, Gin, clean architecture (domain / application / infrastructure / interfaces) |
| Database | PostgreSQL + PostGIS |
| Web app | React + Vite |
| Admin dashboard | React (CSS Modules, Context API) |
| Mobile app | React Native (Expo) |
| Auth | JWT |
| Deployment | Docker Compose + nginx |

## API endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/auth/login` | Admin login |
| POST | `/api/v1/reports` | Submit a hazard report |
| GET | `/api/v1/reports/active` | Approved, currently active reports |
| GET | `/api/v1/network` | Road network graph |
| POST /GET | `/api/v1/route` | Compute safest route between two points |
| GET | `/api/v1/flood-zones` | Active flood zones |
| GET | `/api/v1/weather` | Recent weather/rainfall data |
| GET | `/api/v1/dams` | Dam status |
| — | `/api/v1/admin/*` (JWT-protected) | Approve/reject reports, manage flood zones, weather, dams |

## Running locally

See [MVP-RUN.md](MVP-RUN.md) for a quick local run (Go backend + Vite frontend, no Docker) and [DEPLOY.md](DEPLOY.md) for the full Dockerized stack (Postgres/PostGIS + API + dashboard behind nginx).

## Roadmap

- **Predictive flooding** — a Google Flood Hub gauge poller already exists (`internal/application/floodhub/`) and can auto-create flood zones from gauge data, but it's off by default and untested against the real API (no key was available while building it). Next: validate real watch points and ship it as the default prediction source instead of relying only on manual/reported risk.
- **Low-network resilience** — the app should stay usable when cellular connectivity drops during a disaster, which is often when it's needed most. Planned: P2P caching so devices near each other can share route and hazard data without a live connection to the server.

This was our first full-stack build, done from scratch as a semester project — feedback, comments, and ideas on what to improve or prioritize next are very welcome.
