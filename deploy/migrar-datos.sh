#!/usr/bin/env bash
# Sube una base SQLite de la versión anterior al Droplet. La app la migra sola al arrancar.
#   ./deploy/migrar-datos.sh <ip-del-droplet> <ruta/a/gastos.db>
set -euo pipefail
HOST="${1:?ip}"; DB="${2:?ruta a gastos.db}"
ssh "root@$HOST" 'cd /opt/gastos && docker compose stop app && mkdir -p data/antes && cp -a data/gastos.db* data/antes/ 2>/dev/null || true; rm -f data/gastos.db-wal data/gastos.db-shm'
scp -q "$DB" "root@$HOST:/opt/gastos/data/gastos.db"
ssh "root@$HOST" 'chown 1001:1001 /opt/gastos/data/gastos.db && cd /opt/gastos && docker compose up -d app'
echo "Listo. La base anterior quedó respaldada en /opt/gastos/data/antes/"
