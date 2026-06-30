#!/usr/bin/env sh
set -eu

MONGODB_URI="${MONGODB_URI:-mongodb://localhost:27017}"
MONGODB_DB_NAME="${MONGODB_DB_NAME:-sell_nextgen_db}"
BACKUP_DIR="${BACKUP_DIR:-./backups/$(date +%Y%m%d-%H%M%S)}"

mkdir -p "$BACKUP_DIR"
mongodump --uri="$MONGODB_URI" --db="$MONGODB_DB_NAME" --out="$BACKUP_DIR"
ln -sfn "$BACKUP_DIR" ./backups/latest
echo "Backup written to $BACKUP_DIR"
