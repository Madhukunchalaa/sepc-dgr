# ⚡ DGR Platform — SEPC Power
## Multi-Plant Daily Generation Report System
### Node.js + Express.js · Microservices · PostgreSQL

---

## Architecture Overview

```
                         ┌─────────────────────────────────┐
   Browser / Mobile      │         API GATEWAY :3000        │
   React Frontend  ──────│   (Routing + Auth + Rate Limit)  │
                         └──────┬──────────────────────┬────┘
                                │                      │
            ┌───────────────────┼──────────────────────┼──────────────────┐
            │                   │                      │                  │
     ┌──────▼──────┐   ┌────────▼──────┐   ┌──────────▼──────┐   ┌──────▼────────┐
     │ Auth :3001  │   │ Plant Config  │   │  Data Entry     │   │ DGR Compute  │
     │             │   │   :3002       │   │    :3003        │   │   :3004      │
     │ Login/JWT   │   │ Plants/Meters │   │ Power/Fuel/     │   │ Assembles    │
     │ Refresh     │   │ Fuel Types    │   │ Water/SCADA     │   │ Full DGR     │
     │ Roles       │   │ SCADA Maps    │   │ Upload/Approve  │   │ MTD/YTD Calc │
     └──────┬──────┘   └────────┬──────┘   └──────────┬──────┘   └──────┬───────┘
            │                   │                      │                  │
            └───────────────────┴──────────────────────┴──────────────────┘
                                              │
                                    ┌─────────▼─────────┐
                                    │  Report Export    │
                                    │     :3005         │
                                    │  Excel / PDF /    │
                                    │  SAP / LDC LRS    │
                                    └─────────┬─────────┘
                                              │
                              ┌───────────────▼───────────────┐
                              │        PostgreSQL :5432        │
                              │     Single DB, plant_id        │
                              │     row-level isolation        │
                              └───────────────────────────────┘
```

---

## Quick Start — Local Development

### Prerequisites
- Node.js 20+
- Docker Desktop
- Git

### 1. Clone and install
```bash
git clone https://github.com/sepc/dgr-platform.git
cd dgr-platform
cp .env.example .env        # Fill in your values
npm run install:all
```

### 2. Start PostgreSQL + Redis with Docker
```bash
npm run docker:up
```

### 3. Initialize database
```bash
# Run schema + seed
docker exec -i dgr_postgres psql -U dgr_user -d dgr_platform < infrastructure/postgres/init.sql
```

### 4. Start all services
```bash
npm run dev
```

### Default ports
| Service        | Port | URL                        |
|----------------|------|----------------------------|
| API Gateway    | 3000 | http://localhost:3000      |
| Auth Service   | 3001 | http://localhost:3001      |
| Plant Config   | 3002 | http://localhost:3002      |
| Data Entry     | 3003 | http://localhost:3003      |
| DGR Compute    | 3004 | http://localhost:3004      |
| Report Export  | 3005 | http://localhost:3005      |
| PostgreSQL     | 5432 | localhost:5432             |
| Redis          | 6379 | localhost:6379             |

### Default login
```
Email:    admin@sepcpower.com
Password: Admin@1234   ← Change immediately!
```

---

## API Reference

All requests go through the Gateway on port 3000.
Protected routes require: `Authorization: Bearer <accessToken>`

### Auth Service

| Method | Endpoint                    | Auth | Description                |
|--------|-----------------------------|------|----------------------------|
| POST   | /api/auth/login             | ✗    | Login, returns JWT         |
| POST   | /api/auth/refresh           | ✗    | Refresh access token       |
| POST   | /api/auth/logout            | ✓    | Logout, clears cookie      |
| GET    | /api/auth/me                | ✓    | Current user + plant IDs   |
| POST   | /api/auth/change-password   | ✓    | Change password            |

**Login request:**
```json
POST /api/auth/login
{ "email": "operator@ttpp.com", "password": "Pass@123" }
```

**Login response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "user": {
      "id": "uuid", "email": "...", "fullName": "R. Kumar",
      "role": "shift_in_charge",
      "plantIds": ["uuid-of-ttpp"]
    }
  }
}
```

---

### Plant Config Service

| Method | Endpoint                                | Auth | Roles          |
|--------|-----------------------------------------|------|----------------|
| GET    | /api/plants                             | ✓    | All            |
| GET    | /api/plants/:id                         | ✓    | Plant access   |
| POST   | /api/plants                             | ✓    | it_admin       |
| PATCH  | /api/plants/:id                         | ✓    | it_admin       |
| GET    | /api/plants/:id/meters                  | ✓    | Plant access   |
| GET    | /api/plants/:id/submission-status?date= | ✓    | Plant access   |

---

### Data Entry Service

| Method | Endpoint                                     | Auth | Description              |
|--------|----------------------------------------------|------|--------------------------|
| GET    | /api/data-entry/power/:plantId/:date         | ✓    | Get power entry for date |
| POST   | /api/data-entry/power                        | ✓    | Save/update power entry  |
| POST   | /api/data-entry/power/submit                 | ✓    | Submit for approval      |
| POST   | /api/data-entry/power/approve                | ✓    | SIC approves entry       |
| GET    | /api/data-entry/power/:plantId/history       | ✓    | Historical entries       |
| GET    | /api/data-entry/scada/mappings/:plantId      | ✓    | Get column mappings      |
| POST   | /api/data-entry/scada/mappings/:plantId      | ✓    | Save column mappings     |
| POST   | /api/data-entry/scada/upload/:plantId        | ✓    | Upload + preview SCADA   |
| POST   | /api/data-entry/scada/confirm/:plantId       | ✓    | Confirm SCADA import     |
| GET    | /api/data-entry/submission/:plantId?date=    | ✓    | Module submission status |
| GET    | /api/data-entry/submission/pending/approvals | ✓    | SIC pending queue        |

**Save power entry:**
```json
POST /api/data-entry/power
{
  "plantId": "uuid",
  "entryDate": "2026-02-22",
  "meterReadings": {
    "GEN_MAIN":    9762.977,
    "GEN_CHECK":   9748.653,
    "GT_IMP_MAIN": 9.735,
    "GT_EXP_MAIN": 1842.676,
    "UT_A_IMP":    135.267,
    "UT_B_IMP":    573.815
  },
  "freqMin": 49.82,
  "freqMax": 50.18,
  "freqAvg": 49.98,
  "hoursOnGrid": 24,
  "forcedOutages": 0,
  "plannedOutages": 0,
  "entryMethod": "manual"
}
```

**Response includes auto-computed values:**
```json
{
  "success": true,
  "data": {
    "entry": { "id": "uuid", "status": "draft", "generation_mu": 9.102, ... },
    "computed": {
      "generationMU": 9.102,
      "exportMU": 8.532,
      "importMU": 0.031,
      "apcMU": 0.601,
      "apcPct": 0.066,
      "avgLoadMW": 379.25,
      "plfDaily": 0.921,
      "generationMTD": 198.44,
      "generationYTD": 2841.22
    }
  }
}
```

---

### DGR Compute Service

| Method | Endpoint                          | Auth | Description              |
|--------|-----------------------------------|------|--------------------------|
| GET    | /api/dgr/:plantId/:date           | ✓    | Full DGR for date        |
| GET    | /api/dgr/fleet/:date              | ✓    | HQ fleet summary         |
| GET    | /api/dgr/:plantId/history?from=&to=| ✓   | KPI trend data           |

---

### Report Export Service

| Method | Endpoint                                   | Auth | Description      |
|--------|--------------------------------------------|------|------------------|
| GET    | /api/reports/dgr/excel/:plantId/:date      | ✓    | Excel DGR export |
| GET    | /api/reports/sap/:plantId/:date            | ✓    | SAP format JSON  |

---

## Microservice Responsibilities

| Service       | Owns                                                          |
|---------------|---------------------------------------------------------------|
| Auth          | JWT tokens, sessions, password hashing, user roles            |
| Plant Config  | Plant CRUD, meter points, fuel types, SCADA mappings, status  |
| Data Entry    | All daily data input, SCADA upload, approval workflow         |
| DGR Compute   | MTD/YTD aggregation, DGR assembly (replaces all Excel VLOOKUPs) |
| Report Export | Excel/PDF/SAP generation, streaming file downloads            |

---

## Folder Structure

```
dgr-platform/
├── gateway/                    # API Gateway (port 3000)
│   └── src/index.js
├── services/
│   ├── auth/                   # Auth Service (port 3001)
│   │   └── src/
│   │       ├── controllers/auth.controller.js
│   │       ├── middleware/auth.middleware.js
│   │       └── routes/auth.routes.js
│   ├── plant-config/           # Plant Config Service (port 3002)
│   │   └── src/index.js
│   ├── data-entry/             # Data Entry Service (port 3003)
│   │   └── src/
│   │       ├── controllers/power.controller.js
│   │       ├── controllers/scada.controller.js
│   │       └── routes/
│   ├── dgr-compute/            # DGR Compute Service (port 3004)
│   │   └── src/
│   │       ├── engines/dgr.engine.js    ← Core DGR logic
│   │       └── index.js
│   └── report-export/          # Report Export Service (port 3005)
│       └── src/
│           └── controllers/export.controller.js
├── shared/
│   └── utils/
│       ├── db.js               # PostgreSQL pool (shared)
│       ├── response.js         # Standard API response helpers
│       └── logger.js           # Structured logger
├── infrastructure/
│   ├── docker/docker-compose.yml
│   └── postgres/init.sql       # Full schema + seed data
├── .env.example
└── package.json                # Monorepo workspace config
```

---

## User Roles

| Role             | Data Entry | Approve | Plant Config | HQ View | Manage Users | Add Plants |
|------------------|-----------|---------|--------------|---------|--------------|-----------|
| operator         | ✓         | ✗       | ✗            | ✗       | ✗            | ✗         |
| shift_in_charge  | ✓         | ✓       | ✗            | ✗       | ✗            | ✗         |
| plant_admin      | ✗         | ✗       | ✓            | ✗       | ✓            | ✗         |
| hq_management    | ✗         | ✗       | ✗            | ✓       | ✗            | ✗         |
| it_admin         | ✓         | ✓       | ✓            | ✓       | ✓            | ✓         |

---

## Phase 1 Development Checklist

- [x] Database schema (all tables, indexes, seed)
- [x] API Gateway with proxy routing
- [x] Auth Service (login, JWT, refresh, roles)
- [x] Plant Config Service (CRUD, meters, fuels)
- [x] Data Entry — Power Generation (manual + SCADA)
- [x] SCADA upload + column mapping engine
- [x] Approval workflow (draft → submitted → approved → locked)
- [x] DGR Compute Engine (full VLOOKUP replacement)
- [x] MTD/YTD auto-computation
- [x] Report Export — Excel DGR (ExcelJS)
- [x] Report Export — SAP format
- [x] Docker Compose for local dev
- [x] Audit logging

### Remaining Phase 1 tasks (implement next):
- [ ] Fuel & Ash data entry controller + routes
- [ ] Water data entry controller + routes
- [ ] Availability data entry controller + routes
- [ ] Scheduling (DC/SG/URS) controller + routes
- [ ] Operations Log controller + routes
- [ ] Email alert service (submission deadline)
- [ ] User management endpoints (create/update/delete users)
- [ ] React frontend integration
- [ ] Jest unit tests for DGR engine
- [ ] Input validation (Joi schemas) for all data entry endpoints
