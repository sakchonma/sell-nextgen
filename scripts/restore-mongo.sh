#!/usr/bin/env sh
set -eu

MONGODB_URI="${MONGODB_URI:-mongodb://localhost:27017}"
MONGODB_DB_NAME="${MONGODB_DB_NAME:-sell_nextgen_db}"
BACKUP_PATH="${1:-./backups/latest/$MONGODB_DB_NAME}"

mongorestore --uri="$MONGODB_URI" --db="$MONGODB_DB_NAME" --drop "$BACKUP_PATH"
echo "Restored $MONGODB_DB_NAME from $BACKUP_PATH"
