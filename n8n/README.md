# n8n — Ingesta de recibos desde WhatsApp

Este directorio contiene el workflow de n8n para procesar automáticamente las fotos de recibos enviadas a un grupo de WhatsApp.

## Flujo

```
WhatsApp (grupo)
  → WAHA (gateway HTTP, puerto 3010)
  → Webhook n8n  (responde 200 inmediatamente)
  → Descarga imagen de WAHA
  → OpenAI Vision (o modelo local compatible)
  → Parsea JSON extraído
  → POST /api/recibos (BFF Next.js)
  → Pantalla de revisión en la app
```

---

## Pasos de configuración manual

> Claude Code no puede realizar estos pasos — requieren interacción con UI web o el dispositivo físico.

### 1. Levantar los servicios

```bash
./deploy.sh          # o: podman-compose up -d
```

Verifica que n8n y WAHA están corriendo:

```bash
podman ps | grep -E 'n8n|waha'
```

### 2. Configurar variables de entorno

Copia `.env.example` a `.env` y rellena los valores:

```bash
cp .env.example .env
# Edita .env con tu editor preferido
```

Variables mínimas requeridas:

| Variable | Descripción |
|---|---|
| `OPENAI_API_KEY` | Tu API key de OpenAI (o del proveedor compatible) |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` (cambiar para modelo local) |
| `MODEL_NAME` | `gpt-4o` (debe soportar visión) |

### 3. Vincular WhatsApp con WAHA

1. Abre la dashboard de WAHA en **http://localhost:3010/dashboard**
2. Ve a **Sessions → default → Start** (o crea una sesión nueva)
3. Haz clic en **Attach / QR Code**
4. Escanea el QR con el teléfono que administra el grupo de WhatsApp (WhatsApp → Dispositivos vinculados → Vincular un dispositivo)
5. Espera a que el estado cambie a `WORKING`

> La sesión queda guardada en el volumen `waha_data` y sobrevive reinicios.

### 4. Importar el workflow en n8n

1. Abre la UI de n8n en **http://localhost:5678**
2. Menú → **Workflows → Import from file**
3. Selecciona `n8n/recibos-workflow.json`
4. El workflow se importa en estado **inactivo**

### 5. Escribir el prompt de extracción

Abre el workflow importado y edita el nodo **"Analizar con modelo de visión"**. Reemplaza el texto:

```
TODO: REEMPLAZA ESTE TEXTO CON TU PROMPT DE EXTRACCIÓN...
```

El modelo debe responder **solo con JSON** con esta estructura:

```json
{
  "tipo_detectado": "Nombre del servicio o comercio",
  "monto": 150.00,
  "fecha": "2026-06-15",
  "confianza": 0.92
}
```

Ejemplo de prompt (personaliza según tus servicios):

```
Analiza este recibo y extrae los datos en JSON con exactamente estos campos:
- tipo_detectado: nombre del servicio o comercio (ej: "Luz Enel", "Scotiabank", "Supermercado")
- monto: importe total pagado como número (sin símbolo de moneda)
- fecha: fecha del recibo en formato YYYY-MM-DD
- confianza: tu nivel de confianza del 0 al 1

Responde ÚNICAMENTE con el JSON, sin texto adicional ni bloques de código.
```

### 6. Configurar el webhook de WAHA → n8n

1. En n8n, activa el workflow (toggle **Active**)
2. Copia la URL del webhook: aparece en el nodo "Webhook WAHA" como **Production URL** (algo como `http://localhost:5678/webhook/recibos-whatsapp`)
3. En WAHA Dashboard → **Sessions → default → Configure**
4. En el campo **Webhook URL**, pega la URL del paso anterior
5. En **Webhook Events**, activa **message** y **message.any** (para recibir todos los mensajes del grupo)
6. Guarda

> Si n8n y WAHA corren en la misma red Docker (compose), usa la URL interna: `http://n8n:5678/webhook/recibos-whatsapp`

### 7. Configurar el mapeo WhatsApp → persona

Para que la app sepa a quién asignar el gasto según quién envió el recibo:

1. Abre la app en **http://localhost:3000/configuracion**
2. En **General**, busca los campos WhatsApp JID
3. Ingresa el JID de cada persona (formato: `5219991234567@c.us`)

Para encontrar tu JID: envía cualquier mensaje desde el grupo y revisa los logs del contenedor WAHA (`podman logs gastos-familiares_waha_1`) o la pestaña de eventos en WAHA Dashboard.

### 8. Probar el flujo

1. Desde el teléfono vinculado (o cualquier miembro del grupo), envía una foto de un recibo al grupo de WhatsApp
2. Verifica en n8n → **Executions** que el workflow se ejecutó
3. Abre la app → **Recibos** — el recibo debe aparecer como **pendiente**
4. Revisa los datos detectados, corrige si es necesario, y haz clic en **Confirmar**

---

## Cambiar a un modelo local (Ollama, LM Studio, etc.)

Solo cambia estas dos variables en `.env` y reinicia n8n:

```bash
OPENAI_BASE_URL=http://host.docker.internal:11434/v1   # Ollama
MODEL_NAME=llava:13b                                    # modelo con visión
OPENAI_API_KEY=ollama                                   # valor dummy
```

No hay que tocar el workflow — el nodo usa `$env.OPENAI_BASE_URL` y `$env.MODEL_NAME`.

---

## Solución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| WAHA no recibe mensajes | Sesión desvinculada | Repetir paso 3 (QR) |
| n8n no recibe webhooks | URL incorrecta en WAHA | Verificar paso 6 |
| Recibo sin imagen | `hasMedia: false` | El mensaje no era imagen |
| Error 429 en OpenAI | Rate limit | Reducir frecuencia o subir plan |
| `imagen_path` vacío | Error guardando archivo | Verificar volumen `db-data` |
