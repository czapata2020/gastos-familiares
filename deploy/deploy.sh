#!/usr/bin/env bash
# Construye la imagen en esta máquina (linux/amd64), la sube al Droplet por SSH y reinicia.
# No usa registro: el paquete de GitHub puede quedar privado y el Droplet no compila nada.
#   ./deploy/deploy.sh <ip-del-droplet>
# La primera vez sube también .env.production (créalo a partir de .env.example).
set -euo pipefail
cd "$(dirname "$0")/.."

HOST="${1:?Uso: deploy/deploy.sh <ip>}"
TAG="sha-$(git rev-parse --short HEAD)"
IMG="ghcr.io/czapata2020/gastos-familiares-app"
ENGINE="$(command -v docker || command -v podman)"
SSH="ssh -o StrictHostKeyChecking=accept-new root@$HOST"

echo "[1/4] Construyendo ${IMG}:${TAG}…"
$ENGINE build --platform linux/amd64 -t "$IMG:$TAG" .

echo "[2/4] Subiendo imagen al Droplet..."
$ENGINE save "$IMG:$TAG" | gzip -1 | $SSH 'gunzip | docker load -q'

echo "[3/4] Configuración…"
$SSH 'mkdir -p /opt/gastos/data && chown 1001:1001 /opt/gastos/data'
scp -q compose.yaml "root@$HOST:/opt/gastos/compose.yaml"
if [ -f .env.production ]; then
  scp -q .env.production "root@$HOST:/opt/gastos/.env"
  $SSH 'chmod 600 /opt/gastos/.env'
fi

echo "[4/4] Reiniciando…"
$SSH "cd /opt/gastos && sed -i 's/^TAG=.*/TAG=$TAG/' .env && grep -q '^TAG=' .env || echo TAG=$TAG >> .env
      cd /opt/gastos && docker compose up -d --remove-orphans && docker image prune -f >/dev/null"

for _ in $(seq 1 30); do
  if $SSH 'curl -sf http://127.0.0.1:3000/api/health' >/dev/null 2>&1; then
    echo "OK → https://app.cuentasclaras.stream  ($TAG)"; exit 0
  fi
  sleep 2
done
echo "La app no respondió. Logs: ssh root@$HOST 'cd /opt/gastos && docker compose logs --tail 80'"
exit 1
