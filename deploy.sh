#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# ─────────────────────────────────────────────────────────────────────────────
# Despliegue de PRODUCCIÓN — solo descarga imágenes de GHCR y las levanta.
# No construye, no borra imágenes, no toca volúmenes de datos.
#
#   Uso:   ./deploy.sh                 -> despliega el tag 'latest'
#          ./deploy.sh sha-a1b2c3d     -> despliega una versión concreta (recomendado)
#          ./deploy.sh v1.4.2          -> despliega un tag de versión
#
#   Rollback: ./deploy.sh <tag-anterior>   (la imagen vieja sigue en disco)
# ─────────────────────────────────────────────────────────────────────────────

OWNER="TU_USUARIO"                 # <-- tu usuario/org de GitHub, en minúsculas
COMPOSE_FILE="compose.prod.yaml"
export TAG="${1:-latest}"

OS="$(uname -s)"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Despliegue: Gastos Familiares — tag: $TAG"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. Podman + selección del comando compose ----------------------------------
echo ""
echo "[1/4] Verificando Podman..."
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

# 2. Login a GHCR (solo si el paquete es privado) ----------------------------
# Guarda un token con permiso read:packages en la variable GHCR_TOKEN del entorno.
# Si los paquetes son públicos, puedes borrar este bloque.
if [ -n "${GHCR_TOKEN:-}" ]; then
  echo ""
  echo "[2/4] Login en GHCR..."
  echo "$GHCR_TOKEN" | podman login ghcr.io -u "$OWNER" --password-stdin
  echo "  OK"
else
  echo ""
  echo "[2/4] Sin GHCR_TOKEN — asumiendo paquetes públicos."
fi

# 3. Descargar SOLO el delta y levantar --------------------------------------
echo ""
echo "[3/4] Descargando imágenes ($TAG) y desplegando..."
$COMPOSE -f "$COMPOSE_FILE" pull         # baja solo capas nuevas; reutiliza el resto
$COMPOSE -f "$COMPOSE_FILE" up -d         # SIN --build
echo "  OK"

# 4. Healthchecks ------------------------------------------------------------
echo ""
echo "[4/4] Esperando servicios..."
echo "  DB (hasta 60s)..."
for i in $(seq 1 20); do
  curl -sf http://localhost:3001/health &>/dev/null && { echo "  DB lista."; break; }
  [ "$i" -eq 20 ] && { echo "  ✗ DB no respondió. Logs: $COMPOSE -f $COMPOSE_FILE logs db"; exit 1; }
  sleep 3
done
echo "  App (hasta 30s)..."
for i in $(seq 1 10); do
  curl -sf http://localhost:3000 &>/dev/null && { echo "  App lista."; break; }
  sleep 3
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  App   → http://localhost:3000"
echo "  API   → http://localhost:3001"
echo "  Vault → http://localhost:8200"
echo "  Docs  → http://localhost:3001/api-docs"
echo "  Limpieza ocasional de imágenes viejas:  podman image prune"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""