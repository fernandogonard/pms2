#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Cargar variables de entorno demo
set -a
[ -f backend.env ] && source backend.env
set +a

# Backend demo
cd "$SCRIPT_DIR/../backend"
npm run dev &
BACKEND_PID=$!

# Frontend demo
cd "$SCRIPT_DIR/../frontend"
npm start

wait $BACKEND_PID

wait $BACKEND_PID
