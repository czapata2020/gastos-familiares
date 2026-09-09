#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# ─────────────────────────────────────────────────────────────────────────────
# Despliegue LOCAL (desarrollo) — construye las imágenes desde el código fuente
# y levanta app + db + vault con Podman. No usa GHCR ni requiere login.
#
#   Uso:   ./deploy-local.sh            -> build + up (hot-reload en app)
#          ./deploy-local.sh --no-build -> solo levanta lo ya construido
# ─────────────────────────────────────────────────────────────────────────────

COMPOSE_FILE="compose.yaml"
BUILD_FLAG="--build"
[ "${1:-}" = "--no-build" ] && BUILD_FLAG=""

OS="$(uname -s)"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Despliegue LOCAL: Gastos Familiares"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. Podman + selección del comando compose ----------------------------------
echo ""
echo "[1/3] Verificando Podman..."
if ! podman info &>/dev/null; then
  if [ "$OS" = "Darwin" ]; then
    podman machine start
  else
    echo "  ✗ Podman no responde."
    exit 1
  fi
fi
[ "$OS" != "Darwin" ] && systemctl --user start podman.socket 2>/dev/null || true

if command -v podman-compose &>/dev/null; then
  COMPOSE="podman-compose"
else
  COMPOSE="podman compose"
  PODMAN_SOCK="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/podman/podman.sock"
  [ -S "$PODMAN_SOCK" ] && export DOCKER_HOST="unix://$PODMAN_SOCK"
fi
echo "  Usando: $COMPOSE"

# 2. Build (opcional) + levantar -----------------------------------------------
echo ""
echo "[2/3] Levantando servicios ($COMPOSE_FILE)..."
$COMPOSE -f "$COMPOSE_FILE" up -d $BUILD_FLAG
echo "  OK"

# 3. Healthchecks ------------------------------------------------------------
echo ""
echo "[3/3] Esperando servicios..."
echo "  Vault (hasta 60s)..."
for i in $(seq 1 20); do
  curl -sf http://localhost:8200/v1/sys/health &>/dev/null && { echo "  Vault listo."; break; }
  [ "$i" -eq 20 ] && { echo "  ✗ Vault no respondió. Logs: $COMPOSE -f $COMPOSE_FILE logs vault"; exit 1; }
  sleep 3
done
echo "  DB (hasta 60s)..."
for i in $(seq 1 20); do
  curl -sf http://localhost:3001/health &>/dev/null && { echo "  DB lista."; break; }
  [ "$i" -eq 20 ] && { echo "  ✗ DB no respondió. Logs: $COMPOSE -f $COMPOSE_FILE logs db"; exit 1; }
  sleep 3
done
echo "  App (hasta 60s, npm install + dev server)..."
for i in $(seq 1 20); do
  curl -sf http://localhost:3000 &>/dev/null && { echo "  App lista."; break; }
  [ "$i" -eq 20 ] && { echo "  ✗ App no respondió. Logs: $COMPOSE -f $COMPOSE_FILE logs app"; exit 1; }
  sleep 3
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  App   → http://localhost:3000"
echo "  API   → http://localhost:3001"
echo "  Vault → http://localhost:8200"
echo "  Docs  → http://localhost:3001/api-docs"
echo ""
echo "  Detener:  $COMPOSE -f $COMPOSE_FILE down"
echo "  Logs:     $COMPOSE -f $COMPOSE_FILE logs -f"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
