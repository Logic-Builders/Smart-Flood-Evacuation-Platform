# Flood Evacuation Backend

Smart Flood Evacuation Routing & Alert Platform — Backend Service  
**Stack:** Go · PostgreSQL · PostGIS · Docker

---

## Project Structure

```
flood-evacuation-backend/
│
├── cmd/
│   └── api/                    # Application entry point (main.go)
│
├── config/                     # Config loading (env vars, yaml)
│
├── internal/                   # Private application code
│   ├── domain/                 # Core entities & business rules
│   │   ├── user.go             # User, PublicUser, Admin, RescueTeam
│   │   ├── hazard_report.go    # HazardReport + TTL logic
│   │   ├── road_segment.go     # RoadSegment + risk weight
│   │   ├── flood_risk_zone.go  # FloodRiskZone spatial entity
│   │   ├── evacuation_route.go # EvacuationRoute aggregate
│   │   ├── dam_station.go      # DamStation entity
│   │   └── weather_data.go     # WeatherData value object
│   │
│   ├── application/            # Use cases / service layer
│   │   ├── routing/            # Safe route calculation
│   │   │   └── routing_service.go
│   │   ├── reports/            # Hazard report submission & verification
│   │   │   └── report_service.go
│   │   ├── prediction/         # Flood prediction & risk computation
│   │   │   └── prediction_service.go
│   │   └── alerts/             # Alert broadcasting
│   │       └── alert_service.go
│   │
│   ├── infrastructure/         # External systems & DB
│   │   ├── database/           # DB connection, migrations runner
│   │   │   └── postgres.go
│   │   ├── repositories/       # Concrete DB implementations
│   │   │   ├── road_repository.go
│   │   │   ├── report_repository.go
│   │   │   ├── flood_zone_repository.go
│   │   │   └── user_repository.go
│   │   └── external/           # Adapters for external APIs
│   │       ├── meteorology_adapter.go
│   │       └── irrigation_adapter.go
│   │
│   └── interfaces/             # HTTP layer
│       ├── http/
│       │   ├── handlers/       # One handler per domain area
│       │   │   ├── route_handler.go
│       │   │   ├── report_handler.go
│       │   │   ├── admin_handler.go
│       │   │   └── alert_handler.go
│       │   └── middleware/     # Auth, logging, rate-limit
│       │       ├── auth.go
│       │       └── logger.go
│       └── dto/                # Request/Response structs
│           ├── route_dto.go
│           └── report_dto.go
│
├── pkg/                        # Reusable utilities (safe to import anywhere)
│   ├── graph/                  # Graph model + Dijkstra/A* algorithm
│   │   ├── graph.go
│   │   └── dijkstra.go
│   ├── geo/                    # GeoPoint, Polygon helpers
│   │   └── geo.go
│   └── ttl/                    # TTL validation logic
│       └── ttl.go
│
├── migrations/                 # SQL migration files (numbered)
│   ├── 001_init_schema.sql
│   ├── 002_spatial_indexes.sql
│   └── 003_seed_data.sql
│
├── scripts/                    # Dev helper scripts
│   └── seed.sh
│
├── docker-compose.yml          # Postgres + PostGIS + App
├── Dockerfile
├── go.mod
└── .env.example
```

---

## Architecture Layers

| Layer | Package | Responsibility |
|---|---|---|
| Domain | `internal/domain` | Entities, business rules, no external deps |
| Application | `internal/application` | Use cases, orchestrates domain objects |
| Infrastructure | `internal/infrastructure` | DB, external APIs, concrete implementations |
| Interface | `internal/interfaces` | HTTP handlers, DTOs, middleware |
| Utilities | `pkg/` | Graph, geo math, TTL — framework-free |

---

## Key API Endpoints (planned)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/route` | Request safe evacuation route |
| `POST` | `/api/v1/reports` | Submit flood/hazard report |
| `GET` | `/api/v1/reports` | List reports (admin) |
| `PATCH` | `/api/v1/reports/:id/verify` | Approve/reject report (admin) |
| `GET` | `/api/v1/risk-zones` | Get active flood risk zones |
| `POST` | `/api/v1/admin/flag-area` | Manually flag flood area (admin) |
| `POST` | `/api/v1/alerts` | Broadcast alert to a region (admin) |

---

