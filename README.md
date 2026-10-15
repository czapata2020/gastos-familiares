# Gastos Familiares (Cuentas Claras)

App web para registrar los gastos del hogar entre dos personas y repartirlos según sus salarios.
Pensada primero para el celular. Producción: https://app.cuentasclaras.stream

## Cómo funciona el reparto

- Cada pago se asigna a la persona 1, a la persona 2 o a **Ambos**.
- **Ambos** se divide según los salarios convertidos a la moneda principal (con tipo de cambio si alguien gana en otra moneda), o con un porcentaje manual.
- Los salarios tienen **vigencia** (`repartos.desde`, YYYY-MM): cada mes usa el periodo más reciente que ya empezó. Así, cargar meses pasados respeta el porcentaje que regía entonces.
- El **balance justo** compara lo que cada uno cargó contra lo que le tocaba por salario.

Lógica pura en `lib/reparto.ts` y `lib/metricas.ts`, con tests en `tests/`.

## Arquitectura

```
Celular → Cloudflare Access (código por correo, 2 correos permitidos)
        → Cloudflare Tunnel → Droplet DigitalOcean (sin puertos web abiertos)
            ├─ cloudflared
            └─ app Next.js + SQLite en /opt/gastos/data (backup diario, 14 copias)
```

- `app/` pantallas (Inicio, Registrar, Métricas, Ajustes) y API (`app/api/*`).
- `lib/db.ts` esquema SQLite y migración automática desde la versión 1 (servicios/asignaciones).
- `middleware.ts` verifica el JWT de Cloudflare Access (`CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`) y la lista `ALLOWED_EMAILS`.
- `lib/notificaciones.ts` recordatorios por correo (opcionales, se activan en Ajustes; requiere `SMTP_*`).

## Desarrollo

```bash
cp .env.local.example .env.local
npm install
npm run dev     # http://localhost:3000, entra sin Cloudflare con DEV_USER_EMAIL
npm test
```

## Despliegue

1. Droplet Ubuntu 24.04 con tu SSH key. Prepararlo con los comandos de `deploy/cloud-init.yaml` (como user data o por SSH).
2. Cloudflare Zero Trust → Tunnels: hostname público `app.cuentasclaras.stream` → `http://app:3000`.
3. `cp .env.example .env.production` y completar los valores.
4. `./deploy/deploy.sh <ip-del-droplet>`: construye la imagen aquí, la sube por SSH y reinicia.

Datos de la versión anterior: `./deploy/migrar-datos.sh <ip> ruta/gastos.db`.
Rollback: `ssh root@<ip>`, editar `TAG=` en `/opt/gastos/.env` a una imagen anterior y `docker compose up -d`.

## Hoja de ruta

- Registrar pagos y recibir avisos por WhatsApp (WhatsApp Cloud API de Meta).
