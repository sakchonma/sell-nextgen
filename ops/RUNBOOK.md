# NEXTGEN Operations Runbook

## Production Build / Serve

Recommended production path:

1. Build backend with `npm run build`.
2. Start backend with `npm start` behind a reverse proxy.
3. Build frontend with `npm run build`.
4. Serve `frontend/dist` with nginx, CDN, or the included Docker image.

## Monitoring / Alerting

Minimum alerts:

- `/api/health` non-200 for 2 minutes.
- MongoDB connection mode changes to memory fallback in non-development.
- Backend process restart loop.
- Disk usage above 80%.
- Backup job missing for more than 24 hours.

## Logs

Backend writes access logs under `logs/access.log` in local mode. For Linux servers, install `ops/logrotate-nextgen.conf` as `/etc/logrotate.d/nextgen`.

## Backup Schedule

Daily:

```bash
MONGODB_URI=mongodb://host:27017 MONGODB_DB_NAME=sell_nextgen_db ./scripts/backup-mongo.sh
```

Restore:

```bash
MONGODB_URI=mongodb://host:27017 MONGODB_DB_NAME=sell_nextgen_db ./scripts/restore-mongo.sh ./backups/latest/sell_nextgen_db
```
