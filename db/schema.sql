PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS config (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS servicios (
  id              TEXT PRIMARY KEY,
  nombre          TEXT NOT NULL,
  categoria       TEXT NOT NULL DEFAULT 'otro',
  tipo_gasto      TEXT NOT NULL DEFAULT 'variable',
  monto_fijo      REAL,
  periodicidad    TEXT NOT NULL DEFAULT 'mensual',
  mes_inicio      INTEGER,
  mes_fin         INTEGER,
  dia_vencimiento INTEGER,
  activo              INTEGER NOT NULL DEFAULT 1,
  comentario          TEXT    NOT NULL DEFAULT '',
  cuota_doble         INTEGER NOT NULL DEFAULT 0,
  meses_cuota_doble   TEXT    NOT NULL DEFAULT '[]',
  creado_en           TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS gastos_transversales (
  id          TEXT PRIMARY KEY,
  nombre      TEXT NOT NULL,
  monto       REAL NOT NULL DEFAULT 0,
  periodicidad TEXT NOT NULL DEFAULT 'mensual',
  fecha_inicio TEXT,
  fecha_fin   TEXT,
  activo      INTEGER NOT NULL DEFAULT 1,
  notas       TEXT NOT NULL DEFAULT '',
  creado_en   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS gastos_unicos (
  id          TEXT PRIMARY KEY,
  nombre      TEXT NOT NULL,
  categoria   TEXT NOT NULL DEFAULT 'otro',
  monto_ref   REAL,
  comentario  TEXT NOT NULL DEFAULT '',
  creado_en   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS usos_gasto_unico (
  id              TEXT PRIMARY KEY,
  gasto_unico_id  TEXT NOT NULL,
  gasto_nombre    TEXT NOT NULL,
  gasto_categoria TEXT NOT NULL DEFAULT 'otro',
  mes             INTEGER NOT NULL,
  año             INTEGER NOT NULL,
  monto           REAL NOT NULL DEFAULT 0,
  asignado_a      TEXT NOT NULL DEFAULT 'ambos',
  pagado          INTEGER NOT NULL DEFAULT 0,
  fecha_pago      TEXT,
  creado_en       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notificaciones_enviadas (
  id          TEXT PRIMARY KEY,
  tipo        TEXT NOT NULL,  -- '3dias' | 'vencido'
  servicio_id TEXT NOT NULL,
  mes         INTEGER NOT NULL,
  año         INTEGER NOT NULL,
  enviado_en  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS asignaciones_mes (
  id              TEXT PRIMARY KEY,
  mes             INTEGER NOT NULL,
  año             INTEGER NOT NULL,
  servicio_id     TEXT,
  servicio_nombre TEXT,
  monto           REAL NOT NULL DEFAULT 0,
  asignado_a      TEXT NOT NULL,
  pagado          INTEGER NOT NULL DEFAULT 0,
  fecha_pago      TEXT,
  creado_en       TEXT NOT NULL DEFAULT (datetime('now'))
);
