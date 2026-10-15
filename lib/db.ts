import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'gastos.db')
const BACKUP_DIR = path.join(path.dirname(DB_PATH), 'backups')
const BACKUPS_A_CONSERVAR = 14

export const uid = (prefix: string) => `${prefix}-${randomUUID().slice(0, 8)}`

const SCHEMA = `
CREATE TABLE IF NOT EXISTS config (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS personas (
  id     TEXT PRIMARY KEY CHECK (id IN ('1','2')),
  nombre TEXT NOT NULL,
  email  TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS repartos (
  id                TEXT PRIMARY KEY,
  desde             TEXT NOT NULL UNIQUE,          -- YYYY-MM
  salario1          REAL NOT NULL DEFAULT 0,
  moneda1           TEXT NOT NULL DEFAULT 'PEN',
  salario2          REAL NOT NULL DEFAULT 0,
  moneda2           TEXT NOT NULL DEFAULT 'PEN',
  tipo_cambio       REAL NOT NULL DEFAULT 1,
  porcentaje_manual REAL
);
CREATE TABLE IF NOT EXISTS conceptos (
  id                TEXT PRIMARY KEY,
  nombre            TEXT NOT NULL,
  categoria         TEXT NOT NULL DEFAULT 'otro',
  tipo              TEXT NOT NULL DEFAULT 'variable',  -- fijo | variable | ocasional
  monto_ref         REAL,
  asignado_default  TEXT NOT NULL DEFAULT 'ambos',
  dia_vencimiento   INTEGER,
  meses_activos     TEXT NOT NULL DEFAULT '[]',
  meses_cuota_doble TEXT NOT NULL DEFAULT '[]',
  nota              TEXT NOT NULL DEFAULT '',
  activo            INTEGER NOT NULL DEFAULT 1,
  creado_en         TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS pagos (
  id             TEXT PRIMARY KEY,
  concepto_id    TEXT,
  nombre         TEXT NOT NULL,
  categoria      TEXT NOT NULL DEFAULT 'otro',
  tipo           TEXT NOT NULL DEFAULT 'variable',
  anio           INTEGER NOT NULL,
  mes            INTEGER NOT NULL,
  monto          REAL NOT NULL DEFAULT 0,
  asignado_a     TEXT NOT NULL DEFAULT 'ambos',
  pagado         INTEGER NOT NULL DEFAULT 0,
  fecha_pago     TEXT,
  nota           TEXT NOT NULL DEFAULT '',
  creado_en      TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS pagos_periodo ON pagos (anio, mes);
CREATE UNIQUE INDEX IF NOT EXISTS pagos_concepto_recurrente
  ON pagos (concepto_id, anio, mes) WHERE concepto_id IS NOT NULL AND tipo <> 'ocasional';
`

// Categorías de la versión 1 → categorías agrupadas de la versión 2
const CATEGORIA_V1: Record<string, string> = {
  electricidad: 'servicios', agua: 'servicios', gas: 'servicios', internet: 'servicios', telefono: 'servicios',
  streaming: 'entretenimiento', hipoteca: 'vivienda', asistente_hogar: 'hogar', vigilancia: 'hogar',
  nana: 'hogar', seguridad_vecinal: 'hogar', alimentos: 'alimentos', seguro_vehicular: 'seguros',
  kinder: 'educacion', otro: 'otro',
}

const existeTabla = (db: Database.Database, t: string) =>
  !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(t)

function rango(inicio: number | null, fin: number | null): number[] {
  if (!inicio || !fin) return []
  const out: number[] = []
  for (let m = inicio; ; m = (m % 12) + 1) { out.push(m); if (m === fin || out.length === 12) break }
  return out
}

/** Migra los datos de la versión 1 (servicios, asignaciones, gastos únicos) al esquema nuevo. Corre una sola vez. */
function migrarV1(db: Database.Database) {
  const cfg = Object.fromEntries(
    (db.prepare('SELECT clave, valor FROM config').all() as { clave: string; valor: string }[]).map(r => [r.clave, r.valor]),
  )
  const insPersona = db.prepare('INSERT OR REPLACE INTO personas (id, nombre, email) VALUES (?, ?, ?)')
  insPersona.run('1', cfg.persona1_nombre || 'Persona 1', cfg.persona1_email || '')
  insPersona.run('2', cfg.persona2_nombre || 'Persona 2', cfg.persona2_email || '')

  if (cfg.persona1_salario || cfg.persona2_salario) {
    db.prepare(`INSERT OR IGNORE INTO repartos (id, desde, salario1, moneda1, salario2, moneda2, tipo_cambio)
                VALUES (?, '2000-01', ?, ?, ?, ?, ?)`)
      .run(uid('rep'), parseFloat(cfg.persona1_salario || '0'), cfg.persona1_moneda || 'PEN',
        parseFloat(cfg.persona2_salario || '0'), cfg.persona2_moneda || 'PEN', parseFloat(cfg.tipo_cambio || '1'))
  }

  const insConcepto = db.prepare(`INSERT OR IGNORE INTO conceptos
    (id, nombre, categoria, tipo, monto_ref, dia_vencimiento, meses_activos, meses_cuota_doble, nota, activo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  const tipoServicio = new Map<string, string>()
  const catServicio = new Map<string, string>()

  if (existeTabla(db, 'servicios')) {
    for (const s of db.prepare('SELECT * FROM servicios').all() as Record<string, any>[]) {
      const categoria = CATEGORIA_V1[s.categoria] ?? 'otro'
      const meses = s.periodicidad === 'personalizado' ? rango(s.mes_inicio, s.mes_fin) : []
      const dobles = s.cuota_doble ? (() => { try { return JSON.parse(s.meses_cuota_doble || '[]') } catch { return [] } })() : []
      tipoServicio.set(s.id, s.tipo_gasto)
      catServicio.set(s.id, categoria)
      insConcepto.run(s.id, s.nombre, categoria, s.tipo_gasto === 'fijo' ? 'fijo' : 'variable', s.monto_fijo ?? null,
        s.dia_vencimiento ?? null, JSON.stringify(meses), JSON.stringify(dobles), s.comentario ?? '', s.activo ?? 1)
    }
  }
  if (existeTabla(db, 'gastos_unicos')) {
    for (const g of db.prepare('SELECT * FROM gastos_unicos').all() as Record<string, any>[]) {
      catServicio.set(g.id, CATEGORIA_V1[g.categoria] ?? 'otro')
      insConcepto.run(g.id, g.nombre, CATEGORIA_V1[g.categoria] ?? 'otro', 'ocasional', g.monto_ref ?? null,
        null, '[]', '[]', g.comentario ?? '', 1)
    }
  }

  const insPago = db.prepare(`INSERT OR IGNORE INTO pagos
    (id, concepto_id, nombre, categoria, tipo, anio, mes, monto, asignado_a, pagado, fecha_pago)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  if (existeTabla(db, 'asignaciones_mes')) {
    for (const a of db.prepare('SELECT * FROM asignaciones_mes').all() as Record<string, any>[]) {
      insPago.run(a.id, a.servicio_id, a.servicio_nombre ?? 'Sin nombre', catServicio.get(a.servicio_id) ?? 'otro',
        tipoServicio.get(a.servicio_id) === 'fijo' ? 'fijo' : 'variable', a['año'], a.mes, a.monto,
        a.asignado_a, a.pagado, a.fecha_pago)
    }
  }
  if (existeTabla(db, 'usos_gasto_unico')) {
    for (const u of db.prepare('SELECT * FROM usos_gasto_unico').all() as Record<string, any>[]) {
      insPago.run(u.id, u.gasto_unico_id, u.gasto_nombre, CATEGORIA_V1[u.gasto_categoria] ?? 'otro', 'ocasional',
        u['año'], u.mes, u.monto, u.asignado_a, u.pagado, u.fecha_pago)
    }
  }
}

function sembrar(db: Database.Database) {
  if (!(db.prepare('SELECT COUNT(*) n FROM personas').get() as { n: number }).n) {
    const emails = (process.env.ALLOWED_EMAILS ?? '').split(',').map(e => e.trim()).filter(Boolean)
    db.prepare('INSERT INTO personas (id, nombre, email) VALUES (?, ?, ?)').run('1', 'Cesar Z.', emails[0] ?? '')
    db.prepare('INSERT INTO personas (id, nombre, email) VALUES (?, ?, ?)').run('2', 'Rudy P.', emails[1] ?? '')
  }
  if (!(db.prepare('SELECT COUNT(*) n FROM repartos').get() as { n: number }).n) {
    db.prepare(`INSERT INTO repartos (id, desde) VALUES (?, ?)`).run(uid('rep'), `${new Date().getFullYear()}-01`)
  }
  db.prepare("INSERT OR IGNORE INTO config (clave, valor) VALUES ('moneda', 'PEN')").run()
}

async function backupDiario(db: Database.Database) {
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true })
    const destino = path.join(BACKUP_DIR, `gastos-${new Date().toISOString().slice(0, 10)}.db`)
    if (fs.existsSync(destino)) return
    await db.backup(destino)
    const viejos = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.db')).sort().reverse().slice(BACKUPS_A_CONSERVAR)
    for (const f of viejos) fs.unlinkSync(path.join(BACKUP_DIR, f))
  } catch (err) {
    console.error('[backup] falló:', err)
  }
}

function abrir(): Database.Database {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
  const db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('busy_timeout = 5000')
  db.exec(SCHEMA)

  const version = (db.prepare("SELECT valor FROM config WHERE clave = 'schema_version'").get() as { valor: string } | undefined)?.valor
  if (version !== '2') {
    db.transaction(() => {
      if (existeTabla(db, 'servicios') || existeTabla(db, 'asignaciones_mes')) migrarV1(db)
      sembrar(db)
      db.prepare("INSERT OR REPLACE INTO config (clave, valor) VALUES ('schema_version', '2')").run()
    })()
  }

  if (process.env.NODE_ENV === 'production') {
    void backupDiario(db)
    setInterval(() => void backupDiario(db), 6 * 60 * 60 * 1000).unref()
  }
  return db
}

const g = globalThis as unknown as { __gastosDb?: Database.Database }
export function getDb(): Database.Database {
  if (!g.__gastosDb) g.__gastosDb = abrir()
  return g.__gastosDb
}
