# mini-ipam

IPAM-first Tool mit DCIM-Basisfunktionen fuer kleine bis mittlere Infrastruktur-Umgebungen.  
Die App laeuft lokal (Docker Compose), ist Single-Tenant und fuer Offline-/Lab-Szenarien geeignet.

## Inhalt
1. [Was die App kann](#was-die-app-kann)
2. [Architektur](#architektur)
3. [Schnellstart mit Docker](#schnellstart-mit-docker-empfohlen)
4. [Erste Nutzung (Schritt fuer Schritt)](#erste-nutzung-schritt-fuer-schritt)
5. [Rollen und Berechtigungen](#rollen-und-berechtigungen)
6. [API Uebersicht](#api-uebersicht)
7. [CSV Import/Export](#csv-importexport)
8. [Lokale Entwicklung ohne Docker](#lokale-entwicklung-ohne-docker)
9. [Qualitaet, Tests, Linting](#qualitaet-tests-linting)
10. [Backup/Restore](#backuprestore-postgresql)
11. [Konfiguration (.env)](#konfiguration-env)
12. [Troubleshooting](#troubleshooting)
13. [Produktionshinweise](#produktionshinweise)

## Was die App kann

### IPAM
- VRFs verwalten
- Prefixes verwalten (IPv4/IPv6 CIDR)
- Prefix-Funktionen: Utilization, Next Free IP, Split, Merge
- IP-Adressen verwalten (Status, DNS, Zuweisung, Duplicate-Check pro VRF)
- VLANs verwalten (VID 1-4094, Site-Scoped Konfliktpruefung)
- Bulk-Reservierung von IP-Bereichen
- CSV Import/Export fuer Prefixes, IPs und VLANs

### DCIM
- Sites, Racks und Rack-Placement
- Devices, Interfaces, Patch-Ports
- Cabling inkl. Path-Lookup
- Power-Objekte (Inlets, PDU-Outlets, Power-Connections)
- Detailansichten fuer Device und Rack inklusive History

### Betrieb/Usability
- Globale Suche ueber mehrere Objekttypen
- Reports:
  - IP Utilization
  - Konflikte
  - Unassigned Interfaces
  - Cable Orphans
  - Power Orphans
- Reports unterstuetzen Pagination via `limit` und `offset`
- Health-Checks: `/api/system/healthz`, `/api/system/readyz`
- OpenAPI/Swagger: `/docs`

## Architektur

- Backend: FastAPI, SQLAlchemy, Alembic
- Datenbank: PostgreSQL (Standard), SQLite fuer Dev moeglich
- Frontend: React, Vite, TypeScript, Tailwind
- Deployment lokal: Docker Compose mit `api`, `web`, `db`

## Schnellstart mit Docker (empfohlen)

### Voraussetzungen
- Docker Desktop (inkl. Docker Compose)

### Start
1. `.env` anlegen:
   - Linux/macOS:
   ```bash
   cp .env.example .env
   ```
   - Windows PowerShell:
   ```powershell
   Copy-Item .env.example .env
   ```
2. Container starten:
   ```bash
   docker compose up -d --build
   ```
3. Admin initial bootstrappen (einmalig):
   ```bash
   curl -X POST http://localhost:8000/api/auth/bootstrap
   ```

### Erreichbare URLs
- Web UI: `http://localhost:8080`
- API: `http://localhost:8000`
- API Docs: `http://localhost:8000/docs`

## Erste Nutzung (Schritt fuer Schritt)

1. App starten (siehe Schnellstart).
2. Unter `Admin` einloggen (Default aus `.env`: `ADMIN_USER`/`ADMIN_PASS`).
3. Optional Demo-Daten laden:
   ```bash
   curl -X POST --cookie "session_token=..." http://localhost:8000/api/auth/bootstrap-demo
   ```
4. Empfohlene Reihenfolge im UI:
   - `VRFs` anlegen/pruefen
   - `Prefixes` anlegen
   - `IPs` reservieren/zuweisen
   - `Sites`, `Racks`, `Devices` pflegen
   - `Cabling` und `Power` mappen
   - `Reports` pruefen

## Rollen und Berechtigungen

- `admin`: volle Rechte inkl. Bootstrap-Demo, Schreiben/Loeschen
- `editor`: Schreiben/Loeschen in Fachbereichen
- `readonly`: nur lesend

Berechtigung wird serverseitig geprueft (RBAC).

## API Uebersicht

Vollstaendige API: `GET /docs`

### Auth
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/bootstrap` (einmalige Initialisierung)
- `POST /api/auth/bootstrap-demo` (admin-only, optionale Demo-Daten)

### IPAM
- `GET/POST /api/ipam/vrfs`
- `PUT/DELETE /api/ipam/vrfs/{vrf_id}`
- `GET/POST /api/ipam/prefixes`
- `PUT/DELETE /api/ipam/prefixes/{prefix_id}`
- `GET /api/ipam/prefixes/{prefix_id}/detail`
- `GET /api/ipam/prefixes/{prefix_id}/utilization`
- `GET /api/ipam/prefixes/{prefix_id}/next-free-ip`
- `POST /api/ipam/prefixes/{prefix_id}/split`
- `POST /api/ipam/prefixes/merge`
- `GET/POST /api/ipam/ips`
- `PUT/DELETE /api/ipam/ips/{ip_id}`
- `POST /api/ipam/ips/bulk-reserve`
- `GET/POST /api/ipam/vlans`
- `PUT/DELETE /api/ipam/vlans/{vlan_id}`
- `GET /api/ipam/export/{object_type}`
- `POST /api/ipam/import/{object_type}`
- `GET /api/ipam/history/{object_type}/{object_id}`
- `GET /api/ipam/stats`

### DCIM
- `GET/POST /api/dcim/sites`
- `PUT/DELETE /api/dcim/sites/{site_id}`
- `GET/POST /api/dcim/racks`
- `PUT/DELETE /api/dcim/racks/{rack_id}`
- `GET/POST /api/dcim/devices`
- `GET /api/dcim/devices/{device_id}/detail`
- `PUT/DELETE /api/dcim/devices/{device_id}`
- `GET/POST /api/dcim/interfaces`
- `GET /api/dcim/endpoint-options`
- `GET/POST /api/dcim/patch-ports`
- `PUT/DELETE /api/dcim/patch-ports/{patch_port_id}`
- weitere Cabling/Power-Endpunkte siehe Swagger

### Reports
- `GET /api/reports/ip-utilization?limit=100&offset=0`
- `GET /api/reports/conflicts`
- `GET /api/reports/unassigned-interfaces?limit=100&offset=0`
- `GET /api/reports/cable-orphans?limit=100&offset=0`
- `GET /api/reports/power-orphans?limit=100&offset=0`

### System
- `GET /api/system/healthz`
- `GET /api/system/readyz`
- `GET/POST /api/system/tags`
- `POST /api/system/tag-links`
- `GET/POST /api/system/comments`
- `GET/POST /api/system/attachments`

## CSV Import/Export

Beispiel-Dateien:
- `samples/prefixes.csv`
- `samples/ipaddresses.csv`
- `samples/vlans.csv`

Import:
```bash
curl -X POST -F "file=@samples/prefixes.csv" http://localhost:8000/api/ipam/import/prefixes
```

Export:
```bash
curl -L http://localhost:8000/api/ipam/export/prefixes -o prefixes_export.csv
```

## Lokale Entwicklung ohne Docker

### Backend
```bash
cd backend
python -m venv .venv
# Linux/macOS
source .venv/bin/activate
# Windows PowerShell
# .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

Alternativ Bootstrap per CLI:
```bash
python -m app.scripts.bootstrap --seed-demo
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Qualitaet, Tests, Linting

### Backend
```bash
cd backend
pytest -q
ruff check .
black --check .
```

### Frontend
```bash
cd frontend
npm run lint
npm run build
```

## Backup/Restore (PostgreSQL)

Backup:
```bash
docker compose exec db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backup.sql
```

Restore:
```bash
cat backup.sql | docker compose exec -T db psql -U "$POSTGRES_USER" "$POSTGRES_DB"
```

## Konfiguration (.env)

Wichtige Variablen:
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `SECRET_KEY`
- `ADMIN_USER`, `ADMIN_PASS`
- `CORS_ORIGINS`
- `COOKIE_SECURE`
- `SQLITE_DEV_MODE`
- `UPLOAD_DIR`

Hinweis: In Docker Compose ist `DATABASE_URL` standardmaessig auf PostgreSQL gesetzt.

## Troubleshooting

### "Not authenticated" im Frontend
- Login ueber `Admin` pruefen
- Browser-Cookies nicht blockieren
- API-Basis (`VITE_API_BASE`) kontrollieren

### Alembic/Migrationsproblem
- Sicherstellen, dass Backend-Dependencies installiert sind:
  ```bash
  pip install -r backend/requirements.txt
  ```
- Dann erneut:
  ```bash
  cd backend
  alembic upgrade head
  ```

### Port bereits belegt
- Standardports sind `8080` (Web) und `8000` (API)
- Bei Konflikt Ports in `docker-compose.yml` anpassen

### Leere Reports
- Entweder noch keine Daten vorhanden
- Oder per `bootstrap-demo` Demo-Daten erzeugen

## Produktionshinweise

- `SECRET_KEY` stark und einzigartig setzen
- `COOKIE_SECURE=true` bei HTTPS
- `ADMIN_PASS` sofort aendern
- Regelmaessige DB-Backups einrichten
- Reverse Proxy/TLS vor API schalten

## Lizenz

MIT License.

