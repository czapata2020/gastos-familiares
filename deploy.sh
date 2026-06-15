#!/usr/bin/env bash
set -euo pipefail

# Ejecutar siempre desde el directorio del script, sin importar desde dónde se llame
cd "$(dirname "$0")"

IMAGE_APP="localhost/gastos-familiares_app:latest"
IMAGE_DB="localhost/gastos-familiares_db:latest"
IMAGE_VAULT="localhost/gastos-familiares_vault:latest"
PROJECT="gastos-familiares"
OS="$(uname -s)"


echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Despliegue: Gastos Familiares "
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. Verificar Podman y seleccionar el comando compose
echo ""
echo "[1/6] Verificando Podman..."
if ! podman info &>/dev/null; then
  if [ "$OS" = "Darwin" ]; then
    echo "  Iniciando máquina virtual..."
    podman machine start
  else
    echo "  ✗ Podman no responde. Instálalo con: sudo apt install podman (Debian/Ubuntu)"
    exit 1
  fi
fi

# En Linux, activar el socket de Podman para compatibilidad con docker-compose
if [ "$OS" != "Darwin" ]; then
  systemctl --user start podman.socket 2>/dev/null || true
fi

# Seleccionar el comando compose:
#   1) podman-compose (Python) — directo, sin depender del socket
#   2) podman compose   — nativo si no delega a docker-compose externo
#   3) docker-compose   — vía socket de Podman como fallback
if command -v podman-compose &>/dev/null; then
  COMPOSE="podman-compose"
  echo "  Usando: podman-compose"
else
  COMPOSE="podman compose"
  echo "  Usando: podman compose"
  # Si podman compose delega a docker-compose, apuntarlo al socket de Podman
  PODMAN_SOCK="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/podman/podman.sock"
  if [ -S "$PODMAN_SOCK" ]; then
    export DOCKER_HOST="unix://$PODMAN_SOCK"
  fi
fi
echo "  OK"

# 2. Detener y eliminar contenedores
echo ""
echo "[2/6] Deteniendo contenedores..."
$COMPOSE down 2>/dev/null || true
echo "  OK"

# 3. Eliminar imágenes anteriores
echo ""
echo "[3/6] Eliminando imágenes anteriores..."
podman rmi "$IMAGE_APP"   2>/dev/null && echo "  app eliminada."   || echo "  app: no existía."
podman rmi "$IMAGE_DB"    2>/dev/null && echo "  db eliminada."    || echo "  db: no existía."
podman rmi "$IMAGE_VAULT" 2>/dev/null && echo "  vault eliminada." || echo "  vault: no existía."

# 4. Limpiar huérfanas
echo ""
echo "[4/6] Limpiando imágenes huérfanas..."
podman image prune -f
echo "  OK"

# Verificación
echo ""
echo "── Verificación ─────────────────────"
CONTAINERS=$(podman ps -a --format "{{.Names}}" 2>/dev/null | grep "$PROJECT" || true)
IMAGES=$(podman images --format "{{.Repository}}:{{.Tag}}" 2>/dev/null | grep "$PROJECT" || true)
if [ -z "$CONTAINERS" ] && [ -z "$IMAGES" ]; then
  echo "  Limpio — sin contenedores ni imágenes del proyecto."
else
  [ -n "$CONTAINERS" ] && echo "  AVISO — contenedores: $CONTAINERS"
  [ -n "$IMAGES" ]     && echo "  AVISO — imágenes:     $IMAGES"
fi

# 5. Build y arranque
echo ""
echo "[5/6] Construyendo y desplegando..."
$COMPOSE up --build -d

# Extraer package-lock.json si aún no existe localmente
if [ ! -f package-lock.json ]; then
  echo ""
  echo "  Extrayendo package-lock.json de la imagen app..."
  TEMP=$(podman create "$IMAGE_APP")
  podman cp "$TEMP:/app/package-lock.json" . 2>/dev/null && \
    echo "  Guardado. Comitéalo en git para builds más rápidos." || true
  podman rm "$TEMP" &>/dev/null || true
fi

# 6. Esperar servicios y ejecutar tests
echo ""
echo "[6/6] Esperando servicios y ejecutando tests..."
echo "  Esperando DB (hasta 60s)..."
for i in $(seq 1 20); do
  if curl -sf http://localhost:3001/health &>/dev/null; then
    echo "  DB lista."
    break
  fi
  if [ "$i" -eq 20 ]; then
    echo "  ✗ DB no respondió. Revisa los logs: $COMPOSE logs db"
    exit 1
  fi
  sleep 3
done

echo "  Esperando App (hasta 30s)..."
for i in $(seq 1 10); do
  if curl -sf http://localhost:3000 &>/dev/null; then
    echo "  App lista."
    break
  fi
  sleep 3
done

echo ""
./test.sh

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  App   → http://localhost:3000"
echo "  API   → http://localhost:3001"
echo "  Vault → http://localhost:8200"
echo "  Docs  → http://localhost:3001/api-docs"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
