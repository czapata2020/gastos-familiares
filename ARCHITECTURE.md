# Arquitectura — Gastos Familiares

Aplicación web para gestionar y visualizar gastos compartidos del hogar entre dos personas, con notificaciones por correo y almacenamiento seguro de credenciales.

---

## Stack tecnológico

| Capa | Tecnología | Versión |
|---|---|---|
| Frontend / BFF | Next.js (App Router) | 15.3 |
| UI | React | 19 |
| Lenguaje | TypeScript | 5 |
| Estilos | Tailwind CSS | 3.4 |
| Iconos | Lucide React | 0.511 |
| Fechas | date-fns | 4 |
| API interna | Express.js | — |
| Base de datos | SQLite (better-sqlite3) | — |
| Secrets | OpenBao (fork de Vault) | — |
| Email | Nodemailer | — |
| Tareas programadas | node-cron | — |
| Documentación API | Swagger UI (swagger-jsdoc) | — |
| Contenedores | Podman + podman-compose | — |
| Runtime | Node.js | 22 (Alpine) |

---

## Visión general

```
┌─────────────────────────────────────────────────────────┐
│  Navegador                                              │
│  Next.js App (puerto 3000)                              │
│  ├── Páginas (App Router)                               │
│  └── API Routes /api/* (BFF)                            │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP interno (red Docker)
          ┌──────────┴──────────┐
          ▼                     ▼
┌──────────────────┐   ┌─────────────────┐
│  DB Service      │   │  OpenBao Vault  │
│  Express + SQLite│   │  (puerto 8200)  │
│  (puerto 3001)   │   │  Secrets SMTP   │
└──────────────────┘   └─────────────────┘
```

El frontend de Next.js actúa como **BFF (Backend for Frontend)**: sus API routes proxy las peticiones del cliente hacia el servicio DB y hacia Vault, sin exponer ningún servicio interno al navegador.

---

## Servicios (contenedores)

### `app` — Next.js (puerto 3000)

- Sirve la interfaz y expone las API routes como proxy.
- En desarrollo corre con hot-reload (`npm run dev`).
- Volúmenes nombrados para `node_modules` y `.next` para evitar conflictos con el bind mount del código fuente.

**Variables de entorno**

| Variable | Descripción |
|---|---|
| `DB_URL` | URL del servicio DB (`http://db:3001`) |

### `db` — Express + SQLite (puerto 3001)

- API REST que gestiona todos los datos de la aplicación.
- La base de datos es un único archivo SQLite en `/data/gastos.db`.
- Modo WAL activado para mayor rendimiento en lecturas concurrentes.
- Cron job diario a las 08:00 que verifica vencimientos y envía notificaciones.
- Swagger UI disponible en `/api-docs`.

**Variables de entorno**

| Variable | Descripción |
|---|---|
| `DB_PATH` | Ruta al archivo SQLite (`/data/gastos.db`) |
| `PORT` | Puerto del servidor (3001) |
| `VAULT_ADDR` | URL de OpenBao (`http://vault:8200`) |
| `VAULT_TOKEN_FILE` | Ruta al token de acceso Vault |

### `vault` — OpenBao (puerto 8200)

- Almacena las credenciales SMTP de forma segura.
- El token de acceso se comparte con el servicio DB mediante un volumen (`vault-tokens`).
- Configurado en modo desarrollo con persistencia en `/openbao/data`.

---

## Estructura de archivos

```
gastos-familiares/
├── app/                        # Next.js App Router
│   ├── layout.tsx              # Layout raíz (SidebarLayout)
│   ├── globals.css             # Estilos globales + Tailwind
│   ├── page.tsx                # /  →  Resumen del mes (dashboard)
│   ├── servicios/page.tsx      # /servicios
│   ├── transversales/page.tsx  # /transversales
│   ├── historial/page.tsx      # /historial
│   ├── configuracion/page.tsx  # /configuracion
│   └── api/                    # BFF: proxy hacia DB y Vault
│       ├── settings/           # GET/POST config del hogar
│       ├── servicios/          # CRUD servicios
│       ├── asignaciones/       # CRUD asignaciones mensuales
│       ├── gastos-unicos/      # CRUD plantillas de gastos únicos
│       ├── usos-gasto-unico/   # CRUD instancias mensuales de gastos únicos
│       ├── secrets/            # Proxy SMTP → Vault
│       └── notificaciones/     # Check manual y prueba de email
│
├── components/
│   └── layout/
│       ├── Sidebar.tsx         # Menú lateral colapsable con iconos Lucide
│       └── SidebarLayout.tsx   # Wrapper client que gestiona estado collapsed
│
├── types/
│   └── index.ts                # Tipos compartidos (Persona, Servicio, etc.)
│
├── lib/
│   └── sheets-setup.ts         # (legacy) integración Google Sheets
│
├── db/
│   ├── server.js               # API Express
│   ├── schema.sql              # DDL SQLite
│   ├── package.json
│   └── Dockerfile
│
├── vault/
│   ├── config.hcl              # Configuración OpenBao
│   ├── entrypoint.sh           # Init: unseal, políticas, token
│   └── Dockerfile
│
├── Dockerfile                  # Multi-stage: deps / dev / builder / runner
├── compose.yaml                # Orquestación: app + db + vault
├── deploy.sh                   # Script de despliegue local
├── test.sh                     # Tests de integración HTTP
├── tailwind.config.ts          # Paleta "Sapphire ash morning"
└── next.config.ts
```

---

## Esquema de base de datos (SQLite)

```
config                          servicios
──────────────────              ────────────────────────────────
clave  TEXT PK                  id              TEXT PK
valor  TEXT                     nombre          TEXT
                                categoria       TEXT
                                tipo_gasto      TEXT  (fijo|variable)
asignaciones_mes                monto_fijo      REAL
────────────────────────        periodicidad    TEXT  (mensual|anual|personalizado)
id              TEXT PK         mes_inicio      INTEGER
mes             INTEGER         mes_fin         INTEGER
año             INTEGER         dia_vencimiento INTEGER
servicio_id     TEXT            activo          INTEGER
servicio_nombre TEXT            comentario      TEXT
monto           REAL            cuota_doble     INTEGER
asignado_a      TEXT            meses_cuota_doble TEXT  (JSON array)
pagado          INTEGER
fecha_pago      TEXT            gastos_unicos
                                ────────────────────
gastos_transversales            id          TEXT PK
──────────────────────          nombre      TEXT
id           TEXT PK            categoria   TEXT
nombre       TEXT               monto_ref   REAL
monto        REAL               comentario  TEXT
periodicidad TEXT
fecha_inicio TEXT               usos_gasto_unico
fecha_fin    TEXT               ─────────────────────────
activo       INTEGER            id              TEXT PK
notas        TEXT               gasto_unico_id  TEXT
                                gasto_nombre    TEXT
notificaciones_enviadas         gasto_categoria TEXT
───────────────────────         mes             INTEGER
id           TEXT PK            año             INTEGER
tipo         TEXT (3dias|vencido)monto          REAL
servicio_id  TEXT               asignado_a      TEXT
mes          INTEGER            pagado          INTEGER
año          INTEGER            fecha_pago      TEXT
```

La tabla `config` es un almacén clave-valor. Persiste: nombres, salarios, monedas, tipo de cambio, emails y foto (base64 200×200) de cada persona.

---

## API routes (BFF — Next.js)

| Método | Ruta | Descripción |
|---|---|---|
| GET/POST | `/api/settings` | Configuración del hogar |
| GET/POST | `/api/servicios` | Listar / crear servicios |
| GET/PUT/DELETE | `/api/servicios/[id]` | Servicio por ID |
| GET/POST | `/api/asignaciones` | Asignaciones del mes |
| PATCH/DELETE | `/api/asignaciones/[id]` | Actualizar / eliminar asignación |
| GET/POST | `/api/gastos-unicos` | Plantillas de gastos únicos |
| PUT/DELETE | `/api/gastos-unicos/[id]` | Editar / eliminar plantilla |
| GET/POST | `/api/usos-gasto-unico` | Instancias mensuales |
| PATCH/DELETE | `/api/usos-gasto-unico/[id]` | Actualizar / eliminar instancia |
| GET/PUT | `/api/secrets` | Credenciales SMTP (via Vault) |
| POST | `/api/notificaciones/test` | Enviar email de prueba |
| POST | `/api/notificaciones/check` | Disparar check manual de vencimientos |

---

## Flujo de notificaciones

```
node-cron (08:00 diario)
    │
    ▼
enviarNotificaciones()
    ├── Lee config (emails + preferencias) de SQLite
    ├── Lee servicios activos con dia_vencimiento
    ├── Si hoy == dia - 3  →  aviso "vence en 3 días"
    ├── Si hoy == dia + 1  y  no pagado  →  aviso "venció ayer"
    ├── Obtiene credenciales SMTP de Vault
    └── Envía email HTML con Nodemailer
         (deduplicado por tabla notificaciones_enviadas)
```

---

## Paleta de colores

Tema **"Sapphire ash morning"** definido en `tailwind.config.ts`:

| Token | Hex | Uso |
|---|---|---|
| `brand-500` | `#35627A` | Sidebar, botones primarios, estados activos |
| `terracotta-500` | `#B46258` | Ítem de nav activo |
| `blush` | `#E5AEA9` | Acento del logo en sidebar |
| `lavender` | `#A6A9D0` | Acento secundario |
| `sage` | `#8E9A98` | Textos sutiles |
| `ash` | `#F5F5F5` | Fondo general |
