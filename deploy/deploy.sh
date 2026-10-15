#!/usr/bin/env bash
# Despliega en el Droplet: copia compose.yaml, descarga la imagen y reinicia.
#   ./deploy/deploy.sh <ip-del-droplet> [tag]        ej: ./deploy/deploy.sh 164.90.1.2 sha-a1b2c3d
# La primera vez sube también .env.production (créalo a partir de .env.example).
set -euo pipefail
cd "$(dirname "$0")/.."

HOST="${1:?Uso: deploy/deploy.sh <ip> [tag]}"
TAG="${2:-latest}"
SSH="ssh -o StrictHostKeyChecking=accept-new root@$HOST"

$SSH 'mkdir -p /opt/gastos/data && chown 1001:1001 /opt/gastos/data'
scp -q compose.yaml "root@$HOST:/opt/gastos/compose.yaml"
if [ -f .env.production ]; then
  scp -q .env.production "root@$HOST:/opt/gastos/.env"
  $SSH 'chmod 600 /opt/gastos/.env'
fi

$SSH "cd /opt/gastos && sed -i 's/^TAG=.*/TAG=$TAG/' .env && docker compose pull -q && docker compose up -d --remove-orphans && docker image prune -f >/dev/null"

echo "Esperando a la app…"
for _ in $(seq 1 30); do
  if $SSH 'curl -sf http://127.0.0.1:3000/api/health' >/dev/null 2>&1; then
    echo "OK → https://cuentasclaras.stream  (tag $TAG)"; exit 0
  fi
  sleep 2
done
echo "La app no respondió. Logs: ssh root@$HOST 'cd /opt/gastos && docker compose logs --tail 80'"
exit 1
