# mini-ipam

IPAM-first Tool mit grundlegenden DCIM-Funktionen (Sites, Racks, Cabling inkl. Patchpanel-Pfade, Power Mapping), Single-Tenant, offline-fähig, lokal per Docker Compose startbar.

## Features

### IPAM (Kern)
- VRFs (inkl. Seed `default`)
- Prefixe (CIDR v4/v6, Utilization, Next Free IP, Split, Merge)
- Prefix Detail View API (`/api/ipam/prefixes/{id}/detail`): Overview, IP-Liste, Utilization, History
- Edit/Delete fuer VRF, Prefix, IP, VLAN (`PUT/DELETE` Endpoints)
- IP-Adressen (Status, DNS, Assignment, VRF Duplicate Check, optional out-of-scope)
- VLANs (VID 1-4094, Site Scope, Konfliktcheck)
- Bulk Reserve IP Range
- CSV Import/Export für Prefix/IP/VLAN

### DCIM
- Sites
- Racks + Rack Placements + Front/Rear SVG Diagramm
- Rack Detail View API (`/api/dcim/racks/{id}/detail`) inkl. Missing Power/Cable Indicators
- Devices + Interfaces + Patch Ports
- Device Detail View API (`/api/dcim/devices/{id}/detail`) mit Interfaces, IPs, Cabling, Power, History
- Edit/Delete fuer Site, Rack, Device (`PUT/DELETE` Endpoints)
- Cabling inkl. Single-Connection-Validation (mit `allow_multi` Override)
- Cable Path Lookup (Graph Traversal + Tabellenpfad)
- Cabling UI mit Endpoint-Dropdowns (Interfaces/Patchports), Cable-Liste und Path-Lookup
- Power Entities: Inlets, PDU Outlets, Power Connections, Rack Power Map
- Power UI mit Workflows fuer Inlet/Outlet-Erstellung und Inlet->Outlet-Verbindungen

### Produktive Must-Haves
- Globale Suche über Prefix/IP/VLAN/Device/Rack/Cable
- Audit Log + Objekt-History (`object_history`)
- Tags, Kommentare, Attachments
- Reports: IP Utilization, Konflikte, Unassigned Interfaces, Cable Orphans, Power Orphans
- Health Endpoints: `/api/system/healthz`, `/api/system/readyz`
- OpenAPI/Swagger unter `/docs`

## Architektur
- Backend: FastAPI + SQLAlchemy + Alembic
- Datenbank: PostgreSQL (Default), SQLite optional per `SQLITE_DEV_MODE=true` und `DATABASE_URL=sqlite:///...`
- Frontend: React + Vite + TypeScript + Tailwind
- Deployment: Docker Compose (`api`, `web`, `db`)

## Schnellstart

```bash
cp .env.example .env
docker compose up -d --build
```

- Web UI: http://localhost:8080
- API: http://localhost:8000
- Swagger: http://localhost:8000/docs

Default-Admin bei Erststart via ENV:
- `ADMIN_USER`
- `ADMIN_PASS`

Initialer Bootstrap (explizit, nach Container-Start):

```bash
curl -X POST http://localhost:8000/api/auth/bootstrap
```

Optional Demo-Daten seeden (nach Login als Admin):

```bash
curl -X POST --cookie "session_token=..." http://localhost:8000/api/auth/bootstrap-demo
```

## ENV Konfiguration

Wichtige Variablen:
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- `DATABASE_URL` (im Compose bereits gesetzt)
- `SECRET_KEY`
- `ADMIN_USER`, `ADMIN_PASS`
- `CORS_ORIGINS`
- `COOKIE_SECURE`
- `SQLITE_DEV_MODE`

## Multi-Arch Build

Compose nutzt arch-neutrale Base Images.

Optional explizit multi-arch bauen:

```bash
docker buildx build --platform linux/amd64,linux/arm64 -f backend/Dockerfile -t mini-ipam-api:latest .
docker buildx build --platform linux/amd64,linux/arm64 -f frontend/Dockerfile -t mini-ipam-web:latest .
```

## CSV Import/Export

Templates:
- `samples/prefixes.csv`
- `samples/ipaddresses.csv`
- `samples/vlans.csv`

Import Beispiel:

```bash
curl -X POST \
  -F "file=@samples/prefixes.csv" \
  http://localhost:8000/api/ipam/import/prefixes
```

Export Beispiel:

```bash
curl -L http://localhost:8000/api/ipam/export/prefixes -o prefixes_export.csv
```

## API Beispiel-Requests

Login:

```bash
curl -i -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'
```

Alternativ CLI-Bootstrap (lokale Entwicklung):

```bash
cd backend
python -m app.scripts.bootstrap --seed-demo
```

Prefix anlegen:

```bash
curl -X POST http://localhost:8000/api/ipam/prefixes \
  -H "Content-Type: application/json" \
  -d '{"cidr":"10.40.0.0/24","vrf_id":1,"role":"LAN","status":"active"}'
```

Cable Path Lookup:

```bash
curl "http://localhost:8000/api/dcim/cable-path?endpoint_type=interface&endpoint_id=1"
```

## Backup / Restore (PostgreSQL)

Backup:

```bash
docker compose exec db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backup.sql
```

Restore:

```bash
cat backup.sql | docker compose exec -T db psql -U "$POSTGRES_USER" "$POSTGRES_DB"
```

## Entwicklung lokal ohne Docker

### Backend

```bash
cd backend
python -m venv .venv
. .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Qualität
- Python Lint/Format: `ruff`, `black`
- Frontend Lint/Format: `eslint`, `prettier`
- Unit-Tests für IPAM-Logik in `backend/tests`

## Hinweise
- Single-Tenant Design, lokale Auth mit HTTP-only Session Cookie.
- RBAC serverseitig für `admin/editor/readonly`.
- Für produktiven Internet-Betrieb `COOKIE_SECURE=true` und starkes `SECRET_KEY` setzen.

