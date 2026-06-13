#!/usr/bin/env zsh
# Test de integración HTTP — verifica que todos los endpoints respondan 2XX

DB="http://localhost:3001"
APP="http://localhost:3000"
PASS=0
FAIL=0
CREATED_SRV_ID=""
CREATED_GT_ID=""
CREATED_ASIG_ID=""
CREATED_UNICO_ID=""
CREATED_USO_ID=""

# ─── Helper ───────────────────────────────────────────────────────────────────
check() {
  local desc="$1" method="$2" url="$3" data="${4:-}"
  local code

  if [[ -n "$data" ]]; then
    code=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" \
      -H "Content-Type: application/json" -d "$data" "$url" 2>/dev/null)
  else
    code=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$url" 2>/dev/null)
  fi

  if [[ "$code" == 2* ]]; then
    echo "  ✓  [$code] $method $desc"
    PASS=$((PASS + 1))
  else
    echo "  ✗  [$code] $method $desc"
    FAIL=$((FAIL + 1))
  fi
}

check_and_capture() {
  local desc="$1" method="$2" url="$3" data="${4:-}"
  local response code body

  if [[ -n "$data" ]]; then
    response=$(curl -s -w "\n__CODE__%{http_code}" -X "$method" \
      -H "Content-Type: application/json" -d "$data" "$url" 2>/dev/null)
  else
    response=$(curl -s -w "\n__CODE__%{http_code}" -X "$method" "$url" 2>/dev/null)
  fi

  code="${response##*__CODE__}"
  body="${response%$'\n'__CODE__*}"

  if [[ "$code" == 2* ]]; then
    echo "  ✓  [$code] $method $desc"
    PASS=$((PASS + 1))
    echo "$body"   # caller captures stdout
  else
    echo "  ✗  [$code] $method $desc"
    FAIL=$((FAIL + 1))
    echo ""
  fi
}

extract_id() {
  echo "$1" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4
}

# ─── DB Service ───────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  DB Service  ($DB)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Guardar config original antes de los tests para restaurarla al final
ORIG_CONFIG=$(curl -s "$DB/api/config" 2>/dev/null || echo '{}')

check "Health"         GET "$DB/health"
check "GET  /api/config" GET "$DB/api/config"
check "PUT  /api/config" PUT "$DB/api/config" \
  '{"persona1":{"nombre":"__test__","salario":1,"moneda":"PEN"},"persona2":{"nombre":"__test2__","salario":1,"moneda":"USD"},"moneda":"PEN","tipoCambio":1}'

# Servicios CRUD
body=$(check_and_capture \
  "POST /api/servicios"  POST "$DB/api/servicios" \
  '{"nombre":"__test_luz__","categoria":"electricidad","tipoGasto":"variable","periodicidad":"mensual","diaVencimiento":15}')
CREATED_SRV_ID=$(extract_id "$body")

if [[ -n "$CREATED_SRV_ID" ]]; then
  check "GET  /api/servicios"                    GET    "$DB/api/servicios"
  check "GET  /api/servicios/:id"                GET    "$DB/api/servicios/$CREATED_SRV_ID"
  check "PUT  /api/servicios/:id"                PUT    "$DB/api/servicios/$CREATED_SRV_ID" \
    '{"nombre":"__test_luz_editada__","categoria":"electricidad","tipoGasto":"fijo","montoFijo":80,"periodicidad":"mensual","diaVencimiento":15}'
  check "DELETE /api/servicios/:id"              DELETE "$DB/api/servicios/$CREATED_SRV_ID"
else
  echo "  ⚠  No se pudo obtener ID de servicio creado — saltando tests CRUD de Servicios"
fi

# Gastos Transversales CRUD
body=$(check_and_capture \
  "POST /api/gastos-transversales"  POST "$DB/api/gastos-transversales" \
  '{"nombre":"__test_gt__","monto":200,"periodicidad":"mensual"}')
CREATED_GT_ID=$(extract_id "$body")

if [[ -n "$CREATED_GT_ID" ]]; then
  check "GET  /api/gastos-transversales"         GET    "$DB/api/gastos-transversales"
  check "PUT  /api/gastos-transversales/:id"     PUT    "$DB/api/gastos-transversales/$CREATED_GT_ID" \
    '{"nombre":"__test_gt_edit__","monto":250,"periodicidad":"mensual"}'
  check "DELETE /api/gastos-transversales/:id"   DELETE "$DB/api/gastos-transversales/$CREATED_GT_ID"
fi

# Asignaciones CRUD
body=$(check_and_capture \
  "POST /api/asignaciones"  POST "$DB/api/asignaciones" \
  '{"mes":6,"año":2026,"servicioId":"srv-test","servicioNombre":"Test","monto":100,"asignadoA":"1","pagado":false}')
CREATED_ASIG_ID=$(extract_id "$body")

if [[ -n "$CREATED_ASIG_ID" ]]; then
  check "GET  /api/asignaciones?mes=6&anio=2026"  GET    "$DB/api/asignaciones?mes=6&anio=2026"
  check "PATCH /api/asignaciones/:id"            PATCH  "$DB/api/asignaciones/$CREATED_ASIG_ID" \
    '{"pagado":true,"fechaPago":"2026-06-10"}'
  check "DELETE /api/asignaciones/:id"           DELETE "$DB/api/asignaciones/$CREATED_ASIG_ID"
fi

# Gastos Únicos CRUD
body=$(check_and_capture \
  "POST /api/gastos-unicos"  POST "$DB/api/gastos-unicos" \
  '{"nombre":"__test_cita__","categoria":"otro","montoRef":150,"comentario":"Dr. Test"}')
CREATED_UNICO_ID=$(extract_id "$body")

if [[ -n "$CREATED_UNICO_ID" ]]; then
  check "GET  /api/gastos-unicos"             GET    "$DB/api/gastos-unicos"
  check "PUT  /api/gastos-unicos/:id"         PUT    "$DB/api/gastos-unicos/$CREATED_UNICO_ID" \
    '{"nombre":"__test_cita_edit__","categoria":"otro","montoRef":200,"comentario":"Dr. Test editado"}'

  # Usos Gasto Único CRUD
  body2=$(check_and_capture \
    "POST /api/usos-gasto-unico"  POST "$DB/api/usos-gasto-unico" \
    "{\"gastoUnicoId\":\"$CREATED_UNICO_ID\",\"gastoNombre\":\"__test_cita__\",\"gastoCate\":\"otro\",\"mes\":6,\"año\":2026,\"monto\":150,\"asignadoA\":\"ambos\",\"pagado\":false}")
  CREATED_USO_ID=$(extract_id "$body2")

  if [[ -n "$CREATED_USO_ID" ]]; then
    check "GET  /api/usos-gasto-unico?mes=6&anio=2026"  GET    "$DB/api/usos-gasto-unico?mes=6&anio=2026"
    check "PATCH /api/usos-gasto-unico/:id"             PATCH  "$DB/api/usos-gasto-unico/$CREATED_USO_ID" \
      '{"pagado":true,"fechaPago":"2026-06-10"}'
    check "DELETE /api/usos-gasto-unico/:id"            DELETE "$DB/api/usos-gasto-unico/$CREATED_USO_ID"
  else
    echo "  ⚠  No se pudo obtener ID de uso creado — saltando tests CRUD de Usos"
  fi

  check "DELETE /api/gastos-unicos/:id"       DELETE "$DB/api/gastos-unicos/$CREATED_UNICO_ID"
else
  echo "  ⚠  No se pudo obtener ID de gasto único creado — saltando tests CRUD de Gastos Únicos"
fi

check "GET  /api/secrets/smtp (Vault)"  GET  "$DB/api/secrets/smtp"

# ─── App (BFF) ────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  App BFF  ($APP)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check "GET  /api/settings"  GET  "$APP/api/settings"
check "POST /api/settings"  POST "$APP/api/settings" \
  '{"persona1":{"nombre":"César","salario":100000,"moneda":"PEN"},"persona2":{"nombre":"Pareja","salario":50000,"moneda":"USD"},"moneda":"PEN","tipoCambio":3.75}'
check "GET  /api/servicios" GET  "$APP/api/servicios"
check "GET  /api/gastos-unicos"                           GET  "$APP/api/gastos-unicos"
check "GET  /api/usos-gasto-unico?mes=6&anio=2026"        GET  "$APP/api/usos-gasto-unico?mes=6&anio=2026"
check "GET  /api/asignaciones?mes=6&anio=2026"            GET  "$APP/api/asignaciones?mes=6&anio=2026"
check "GET  /api/secrets (SMTP status)"                   GET  "$APP/api/secrets"

# ─── Restaurar config original ────────────────────────────────────────────────
if [[ "$ORIG_CONFIG" != "{}" && -n "$ORIG_CONFIG" ]]; then
  curl -s -X PUT -H "Content-Type: application/json" -d "$ORIG_CONFIG" "$DB/api/config" > /dev/null 2>&1 || true
fi

# ─── Resultado ────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
TOTAL=$((PASS + FAIL))
echo "  Resultado: $PASS/$TOTAL pasaron"
if [[ $FAIL -gt 0 ]]; then
  echo "  ✗ $FAIL test(s) fallaron"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 1
fi
echo "  ✓ Todos los tests pasaron"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
