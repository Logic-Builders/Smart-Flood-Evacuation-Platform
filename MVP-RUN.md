# Run locally (3-hour MVP)

## Prerequisites
- Go 1.21+
- Node.js 18+

## 1. Start backend

```powershell
cd backend\app
go run .\cmd\api\main.go
```

API: http://localhost:8080  
Admin login: `admin` / `admin123`

## 2. Start frontend (new terminal)

```powershell
cd frontend
npm install
npm run dev
```

App: http://localhost:3000

## MVP demo flow
1. **Route tab** — pick start & end on map → Find Safest Route
2. **Report tab** — pick flooded location → submit report
3. **Admin tab** — login → approve report
4. Go back to **Route** — approved hazards affect routing weights

## API endpoints
- `GET /health`
- `GET /api/v1/network`
- `POST /api/v1/route` `{ start_lat, start_lng, end_lat, end_lng }`
- `POST /api/v1/reports`
- `GET /api/v1/reports/active`
- `POST /auth/login`
- `PATCH /api/v1/admin/reports/:id/approve` (Bearer token)
