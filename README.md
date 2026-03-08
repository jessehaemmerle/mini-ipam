# mini-ipam

Schlankes IPAM-Tool fuer lokale Umgebungen.

## Funktionen
- VRFs verwalten
- Prefixes verwalten (CIDR)
- Prefix-Funktionen: Utilization, Next Free IP, Split, Merge
- IP-Adressen verwalten (Status, DNS, Duplicate-Check pro VRF)
- VLANs verwalten (VID 1-4094)
- Bulk-Reservierung von IP-Bereichen
- CSV Import/Export fuer Prefixes, IPs und VLANs
- IPAM-Suche ueber Prefixes, IPs und VLANs

## Stack
- Backend: FastAPI, SQLAlchemy, Alembic
- Frontend: React, Vite, TypeScript, Tailwind
- DB: PostgreSQL (Standard), SQLite fuer Dev moeglich

## Schnellstart (Docker)
1. `.env` erstellen (`cp .env.example .env`)
2. `docker compose up -d --build`
3. Admin bootstrap: `POST /api/auth/bootstrap`

## UI-Bereiche
- Start
- Netzraeume (VRF)
- Netzbereiche
- IP-Adressen
- VLANs
- Admin
- Einstellungen

## API (Auszug)
### Auth
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/bootstrap`
- `POST /api/auth/bootstrap-demo`

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

### Search
- `GET /api/search?q=...`

## Entwicklung
### Backend
```bash
cd backend
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
