#!/bin/sh
set -e

INIT_FILE="/openbao/data/.init.json"
TOKEN_FILE="/vault-tokens/app.token"
ADDR="http://127.0.0.1:8200"

echo "[Vault] Iniciando servidor OpenBao..."
bao server -config=/etc/openbao/config.hcl &
PID=$!

# Esperar a que el servidor responda (bao status imprime tabla incluso cuando sellado)
echo "[Vault] Esperando que el servidor responda..."
i=0
while [ $i -lt 60 ]; do
  if bao status -address="$ADDR" 2>/dev/null | grep -q "Seal Type"; then break; fi
  sleep 1; i=$((i+1))
done

# Inicializar si no existe el archivo de claves (o si está vacío)
if [ ! -s "$INIT_FILE" ]; then
  echo "[Vault] Primera vez — inicializando bóveda..."
  TMP_INIT="${INIT_FILE}.tmp"
  bao operator init \
    -address="$ADDR" \
    -key-shares=1 \
    -key-threshold=1 \
    -format=json > "$TMP_INIT" && mv "$TMP_INIT" "$INIT_FILE" || rm -f "$TMP_INIT"
  chmod 600 "$INIT_FILE"
fi

# Parsear claves del archivo de inicialización (JSON multi-línea)
UNSEAL_KEY=$(grep -A1 'unseal_keys_b64' "$INIT_FILE" | tail -1 | tr -d ' "')
ROOT_TOKEN=$(grep '"root_token"' "$INIT_FILE" | cut -d'"' -f4)

# Desbloquear bóveda
echo "[Vault] Desbloqueando bóveda..."
bao operator unseal -address="$ADDR" "$UNSEAL_KEY" >/dev/null 2>&1 || true

export VAULT_TOKEN="$ROOT_TOKEN"

# Habilitar motor KV v2 (solo la primera vez — falla silenciosamente si ya existe)
bao secrets list -address="$ADDR" 2>/dev/null | grep -q "^secret/" || {
  echo "[Vault] Habilitando motor de secretos KV..."
  bao secrets enable -address="$ADDR" -path=secret kv-v2 >/dev/null 2>&1 || true
}

# Guardar token para que el servicio DB lo lea
mkdir -p "$(dirname "$TOKEN_FILE")"
echo "$ROOT_TOKEN" > "$TOKEN_FILE"
chmod 600 "$TOKEN_FILE"

echo "[Vault] ✓ Listo — UI en http://127.0.0.1:8200 (token en vault-tokens)"
wait "$PID"
