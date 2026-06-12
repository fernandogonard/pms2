#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Cargar variables demo
set -a
source backend.env
set +a

BACKUP_FILE="$SCRIPT_DIR/../backend/backups/backup_json_20251226-010000.json"
if [ ! -f "$BACKUP_FILE" ]; then
  echo "No se encontró el backup de demo en $BACKUP_FILE"
  exit 1
fi

cd "$SCRIPT_DIR/../backend"
node scripts/restoreBackup.js "$BACKUP_FILE"
