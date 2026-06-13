#!/usr/bin/env zsh
set -euo pipefail

IMAGE_APP="localhost/gastos-familiares_app:latest"
IMAGE_DB="localhost/gastos-familiares_db:latest"
PROJECT="gastos-familiares"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Despliegue: Gastos Familiares"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. Verificar Podman
echo "\n[1/6] Verificando Podman..."
if ! podman info &>/dev/null; then
  echo "  Iniciando máquina virtual..."
  podman machine start
fi
echo "  OK"

# 2. Detener y eliminar contenedores
echo "\n[2/6] Deteniendo contenedores..."
podman compose down 2>/dev/null || true
echo "  OK"

# 3. Eliminar imágenes anteriores
echo "\n[3/6] Eliminando imágenes anteriores..."
podman rmi "$IMAGE_APP" 2>/dev/null && echo "  app eliminada." || echo "  app: no existía."
podman rmi "$IMAGE_DB"  2>/dev/null && echo "  db eliminada."  || echo "  db: no existía."

# 4. Limpiar huérfanas
echo "\n[4/6] Limpiando imágenes huérfanas..."
podman image prune -f
echo "  OK"

# Verificación
echo "\n── Verificación ─────────────────────"
CONTAINERS=$(podman ps -a --format "{{.Names}}" 2>/dev/null | grep "$PROJECT" || true)
IMAGES=$(podman images --format "{{.Repository}}:{{.Tag}}" 2>/dev/null | grep "$PROJECT" || true)
if [[ -z "$CONTAINERS" && -z "$IMAGES" ]]; then
  echo "  Limpio — sin contenedores ni imágenes del proyecto."
else
  [[ -n "$CONTAINERS" ]] && echo "  AVISO — contenedores: $CONTAINERS"
  [[ -n "$IMAGES" ]]     && echo "  AVISO — imágenes:     $IMAGES"
fi

# 5. Build y arranque
echo "\n[5/6] Construyendo y desplegando..."
podman compose up --build -d

# Extraer package-lock.json si aún no existe localmente
if [[ ! -f package-lock.json ]]; then
  echo "\n  Extrayendo package-lock.json de la imagen app..."
  TEMP=$(podman create "$IMAGE_APP")
  podman cp "$TEMP:/app/package-lock.json" . 2>/dev/null && \
    echo "  Guardado. Comitéalo en git para builds más rápidos." || true
  podman rm "$TEMP" &>/dev/null || true
fi

# 6. Esperar servicios y ejecutar tests
echo "\n[6/6] Esperando servicios y ejecutando tests..."
echo "  Esperando DB (hasta 60s)..."
for i in {1..20}; do
  if curl -sf http://localhost:3001/health &>/dev/null; then
    echo "  DB lista."
    break
  fi
  if [[ $i -eq 20 ]]; then
    echo "  ✗ DB no respondió. Revisa los logs: podman compose logs db"
    exit 1
  fi
  sleep 3
done

echo "  Esperando App (hasta 30s)..."
for i in {1..10}; do
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
echo "  Docs  → http://localhost:3001/api-docs"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
