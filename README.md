# NEXTGEN Sale & Support

MVP web app for sales CRM, quotes, requests, tasks, AI logger, reports, notifications, and admin operations.

## Local Development

Backend:

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Default URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5001`
- Health check: `http://localhost:5001/api/health`

## Required Production Environment

- `NODE_ENV=production`
- `JWT_SECRET` length 32+ characters
- `MONGODB_URI`
- `MONGODB_DB_NAME`
- `CORS_ORIGIN`, comma-separated frontend origins
- `ALLOW_MEMORY_DB=false`

## Checks

```bash
cd backend && npm run check
cd frontend && npm run check
```

## Docker Compose

```bash
docker compose up --build
```

This starts MongoDB, backend, and frontend preview server.

## Backup / Restore

```bash
./scripts/backup-mongo.sh
./scripts/restore-mongo.sh ./backups/latest
```

Set `MONGODB_URI` and `MONGODB_DB_NAME` before running against production.
