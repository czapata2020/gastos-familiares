'use strict'

const express     = require('express')
const Database    = require('better-sqlite3')
const swaggerUi   = require('swagger-ui-express')
const swaggerJsdoc = require('swagger-jsdoc')
const cors        = require('cors')
const { randomUUID } = require('crypto')
const path        = require('path')
const fs          = require('fs')

// ── Setup ──────────────────────────────────────────────────────────────────────
const app     = express()
const DB_PATH = process.env.DB_PATH || '/data/gastos.db'
const PORT    = process.env.PORT || 3001

// ── Vault client ──────────────────────────────────────────────────────────────
const VAULT_ADDR       = process.env.VAULT_ADDR       || ''
const VAULT_TOKEN_FILE = process.env.VAULT_TOKEN_FILE || ''

function getVaultToken() {
  if (VAULT_TOKEN_FILE && fs.existsSync(VAULT_TOKEN_FILE)) {
    return fs.readFileSync(VAULT_TOKEN_FILE, 'utf8').trim()
  }
  return process.env.VAULT_TOKEN || ''
}

async function vaultRead(secretPath) {
  const token = getVaultToken()
  if (!VAULT_ADDR || !token) return null
  try {
    const res = await fetch(`${VAULT_ADDR}/v1/secret/data/${secretPath}`, {
      headers: { 'X-Vault-Token': token },
    })
    if (!res.ok) return null
    const json = await res.json()
    return json.data?.data ?? null
  } catch { return null }
}

async function vaultWrite(secretPath, data) {
  const token = getVaultToken()
  if (!VAULT_ADDR || !token) return false
  try {
    const res = await fetch(`${VAULT_ADDR}/v1/secret/data/${secretPath}`, {
      method: 'POST',
      headers: { 'X-Vault-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    })
    return res.ok
  } catch { return false }
}

app.use(cors())
app.use(express.json())

// ── Database ──────────────────────────────────────────────────────────────────
const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')
db.exec(schema)

// Migrations for existing DBs
try { db.prepare("ALTER TABLE servicios ADD COLUMN comentario TEXT NOT NULL DEFAULT ''").run() } catch (_) {}
try { db.prepare("ALTER TABLE servicios ADD COLUMN cuota_doble INTEGER NOT NULL DEFAULT 0").run() } catch (_) {}
try { db.prepare("ALTER TABLE servicios ADD COLUMN meses_cuota_doble TEXT NOT NULL DEFAULT '[]'").run() } catch (_) {}

// Seed config defaults if empty
const { count } = db.prepare('SELECT COUNT(*) as count FROM config').get()
if (count === 0) {
  const ins = db.prepare('INSERT OR IGNORE INTO config (clave, valor) VALUES (?, ?)')
  for (const [k, v] of [
    ['persona1_nombre', 'Persona 1'], ['persona1_salario', '0'], ['persona1_moneda', 'PEN'],
    ['persona2_nombre', 'Persona 2'], ['persona2_salario', '0'], ['persona2_moneda', 'USD'],
    ['moneda', 'PEN'], ['tipo_cambio', '1'],
  ]) ins.run(k, v)
}

// ── Swagger ───────────────────────────────────────────────────────────────────
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: { title: 'Gastos Familiares API', version: '1.0.0',
            description: 'API REST para gestión de gastos familiares compartidos' },
    servers: [{ url: `http://localhost:${PORT}`, description: 'Local' }],
    tags: [
      { name: 'Health',     description: 'Estado del servicio' },
      { name: 'Config',     description: 'Configuración del hogar' },
      { name: 'Servicios',  description: 'Servicios del hogar (luz, agua, etc.)' },
      { name: 'Transversales', description: 'Gastos compartidos recurrentes' },
      { name: 'Asignaciones',  description: 'Asignaciones mensuales de servicios' },
    ],
  },
  apis: [__filename],
})
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

// ── Helpers ───────────────────────────────────────────────────────────────────
const uid = () => randomUUID().slice(0, 8)

function rowToServicio(r) {
  return {
    id: r.id, nombre: r.nombre, categoria: r.categoria,
    tipoGasto: r.tipo_gasto, montoFijo: r.monto_fijo,
    periodicidad: r.periodicidad, mesInicio: r.mes_inicio,
    mesFin: r.mes_fin, diaVencimiento: r.dia_vencimiento,
    activo: r.activo === 1,
    comentario: r.comentario ?? '',
    cuotaDoble: r.cuota_doble === 1,
    mesesCuotaDoble: (() => { try { return JSON.parse(r.meses_cuota_doble || '[]') } catch { return [] } })(),
  }
}

function rowToTransversal(r) {
  return {
    id: r.id, nombre: r.nombre, monto: r.monto,
    periodicidad: r.periodicidad, fechaInicio: r.fecha_inicio,
    fechaFin: r.fecha_fin, activo: r.activo === 1, notas: r.notas,
  }
}

function rowToAsignacion(r) {
  return {
    id: r.id, mes: r.mes, año: r.año,
    servicioId: r.servicio_id, servicioNombre: r.servicio_nombre,
    monto: r.monto, asignadoA: r.asignado_a,
    pagado: r.pagado === 1, fechaPago: r.fecha_pago,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HEALTH
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Verifica que el servicio y la base de datos estén operativos
 *     responses:
 *       200:
 *         description: Servicio OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: ok }
 *                 db:     { type: string, example: /data/gastos.db }
 */
app.get('/health', (_req, res) => {
  db.prepare('SELECT 1').get()   // will throw if DB is broken
  res.json({ status: 'ok', db: DB_PATH })
})

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @openapi
 * /api/config:
 *   get:
 *     tags: [Config]
 *     summary: Obtiene la configuración del hogar
 *     responses:
 *       200:
 *         description: Configuración actual
 */
app.get('/api/config', (_req, res) => {
  const rows = db.prepare('SELECT clave, valor FROM config').all()
  const m = Object.fromEntries(rows.map(r => [r.clave, r.valor]))
  res.json({
    persona1: { nombre: m.persona1_nombre ?? 'Persona 1', salario: parseFloat(m.persona1_salario ?? '0'), moneda: m.persona1_moneda ?? 'PEN', email: m.persona1_email ?? '', notificaciones: m.persona1_notificaciones !== '0' },
    persona2: { nombre: m.persona2_nombre ?? 'Persona 2', salario: parseFloat(m.persona2_salario ?? '0'), moneda: m.persona2_moneda ?? 'USD', email: m.persona2_email ?? '', notificaciones: m.persona2_notificaciones !== '0' },
    moneda: m.moneda ?? 'PEN',
    tipoCambio: parseFloat(m.tipo_cambio ?? '1'),
  })
})

/**
 * @openapi
 * /api/config:
 *   put:
 *     tags: [Config]
 *     summary: Actualiza la configuración del hogar
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               persona1:   { type: object }
 *               persona2:   { type: object }
 *               moneda:     { type: string }
 *               tipoCambio: { type: number }
 *     responses:
 *       200:
 *         description: Configuración guardada
 */
app.put('/api/config', (req, res) => {
  const { persona1, persona2, moneda, tipoCambio } = req.body
  const upsert = db.prepare('INSERT OR REPLACE INTO config (clave, valor) VALUES (?, ?)')
  db.transaction(() => {
    for (const [k, v] of [
      ['persona1_nombre', persona1.nombre], ['persona1_salario', String(persona1.salario)], ['persona1_moneda', persona1.moneda], ['persona1_email', persona1.email ?? ''], ['persona1_notificaciones', persona1.notificaciones === false ? '0' : '1'],
      ['persona2_nombre', persona2.nombre], ['persona2_salario', String(persona2.salario)], ['persona2_moneda', persona2.moneda], ['persona2_email', persona2.email ?? ''], ['persona2_notificaciones', persona2.notificaciones === false ? '0' : '1'],
      ['moneda', moneda], ['tipo_cambio', String(tipoCambio)],
    ]) upsert.run(k, v)
  })()
  res.json({ ok: true })
})

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICIOS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @openapi
 * /api/servicios:
 *   get:
 *     tags: [Servicios]
 *     summary: Lista todos los servicios activos
 *     responses:
 *       200:
 *         description: Array de servicios
 */
app.get('/api/servicios', (_req, res) => {
  const rows = db.prepare('SELECT * FROM servicios WHERE activo = 1 ORDER BY nombre').all()
  res.json(rows.map(rowToServicio))
})

/**
 * @openapi
 * /api/servicios:
 *   post:
 *     tags: [Servicios]
 *     summary: Crea un nuevo servicio
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nombre, categoria, tipoGasto, periodicidad]
 *             properties:
 *               nombre:         { type: string }
 *               categoria:      { type: string, enum: [electricidad,agua,gas,internet,telefono,streaming,otro] }
 *               tipoGasto:      { type: string, enum: [fijo, variable] }
 *               montoFijo:      { type: number }
 *               periodicidad:   { type: string, enum: [mensual, anual, personalizado] }
 *               mesInicio:      { type: integer }
 *               mesFin:         { type: integer }
 *               diaVencimiento: { type: integer }
 *     responses:
 *       201:
 *         description: Servicio creado
 */
app.post('/api/servicios', (req, res) => {
  const s = req.body
  const id = `srv-${uid()}`
  db.prepare(`INSERT INTO servicios (id, nombre, categoria, tipo_gasto, monto_fijo, periodicidad, mes_inicio, mes_fin, dia_vencimiento, comentario, cuota_doble, meses_cuota_doble)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, s.nombre, s.categoria, s.tipoGasto, s.montoFijo ?? null,
         s.periodicidad, s.mesInicio ?? null, s.mesFin ?? null, s.diaVencimiento ?? null,
         (s.comentario ?? '').toString().slice(0, 100),
         s.cuotaDoble ? 1 : 0,
         JSON.stringify(Array.isArray(s.mesesCuotaDoble) ? s.mesesCuotaDoble : []))
  res.status(201).json({ ok: true, id })
})

/**
 * @openapi
 * /api/servicios/{id}:
 *   get:
 *     tags: [Servicios]
 *     summary: Obtiene un servicio por ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Servicio encontrado
 *       404:
 *         description: No encontrado
 */
app.get('/api/servicios/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM servicios WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'No encontrado' })
  res.json(rowToServicio(row))
})

/**
 * @openapi
 * /api/servicios/{id}:
 *   put:
 *     tags: [Servicios]
 *     summary: Actualiza un servicio existente
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object }
 *     responses:
 *       200:
 *         description: Servicio actualizado
 *       404:
 *         description: No encontrado
 */
app.put('/api/servicios/:id', (req, res) => {
  const s = req.body
  const result = db.prepare(`UPDATE servicios
    SET nombre=?, categoria=?, tipo_gasto=?, monto_fijo=?, periodicidad=?, mes_inicio=?, mes_fin=?, dia_vencimiento=?, comentario=?, cuota_doble=?, meses_cuota_doble=?
    WHERE id=?`)
    .run(s.nombre, s.categoria, s.tipoGasto, s.montoFijo ?? null,
         s.periodicidad, s.mesInicio ?? null, s.mesFin ?? null, s.diaVencimiento ?? null,
         (s.comentario ?? '').toString().slice(0, 100),
         s.cuotaDoble ? 1 : 0,
         JSON.stringify(Array.isArray(s.mesesCuotaDoble) ? s.mesesCuotaDoble : []),
         req.params.id)
  if (result.changes === 0) return res.status(404).json({ error: 'No encontrado' })
  res.json({ ok: true })
})

/**
 * @openapi
 * /api/servicios/{id}:
 *   delete:
 *     tags: [Servicios]
 *     summary: Elimina un servicio
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Servicio eliminado
 *       404:
 *         description: No encontrado
 */
app.delete('/api/servicios/:id', (req, res) => {
  const result = db.prepare('DELETE FROM servicios WHERE id = ?').run(req.params.id)
  if (result.changes === 0) return res.status(404).json({ error: 'No encontrado' })
  res.json({ ok: true })
})

// ═══════════════════════════════════════════════════════════════════════════════
// GASTOS TRANSVERSALES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @openapi
 * /api/gastos-transversales:
 *   get:
 *     tags: [Transversales]
 *     summary: Lista todos los gastos transversales activos
 *     responses:
 *       200:
 *         description: Array de gastos transversales
 */
app.get('/api/gastos-transversales', (_req, res) => {
  const rows = db.prepare('SELECT * FROM gastos_transversales WHERE activo = 1 ORDER BY nombre').all()
  res.json(rows.map(rowToTransversal))
})

/**
 * @openapi
 * /api/gastos-transversales:
 *   post:
 *     tags: [Transversales]
 *     summary: Crea un nuevo gasto transversal
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nombre, monto, periodicidad]
 *             properties:
 *               nombre:      { type: string }
 *               monto:       { type: number }
 *               periodicidad: { type: string }
 *               fechaInicio: { type: string }
 *               fechaFin:    { type: string }
 *               notas:       { type: string }
 *     responses:
 *       201:
 *         description: Gasto creado
 */
app.post('/api/gastos-transversales', (req, res) => {
  const g = req.body
  const id = `gt-${uid()}`
  db.prepare(`INSERT INTO gastos_transversales (id, nombre, monto, periodicidad, fecha_inicio, fecha_fin, notas)
              VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(id, g.nombre, g.monto, g.periodicidad, g.fechaInicio ?? null, g.fechaFin ?? null, g.notas ?? '')
  res.status(201).json({ ok: true, id })
})

/**
 * @openapi
 * /api/gastos-transversales/{id}:
 *   put:
 *     tags: [Transversales]
 *     summary: Actualiza un gasto transversal
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object }
 *     responses:
 *       200:
 *         description: Gasto actualizado
 *       404:
 *         description: No encontrado
 */
app.put('/api/gastos-transversales/:id', (req, res) => {
  const g = req.body
  const result = db.prepare(`UPDATE gastos_transversales
    SET nombre=?, monto=?, periodicidad=?, fecha_inicio=?, fecha_fin=?, notas=?
    WHERE id=?`)
    .run(g.nombre, g.monto, g.periodicidad, g.fechaInicio ?? null, g.fechaFin ?? null, g.notas ?? '', req.params.id)
  if (result.changes === 0) return res.status(404).json({ error: 'No encontrado' })
  res.json({ ok: true })
})

/**
 * @openapi
 * /api/gastos-transversales/{id}:
 *   delete:
 *     tags: [Transversales]
 *     summary: Elimina un gasto transversal
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Gasto eliminado
 *       404:
 *         description: No encontrado
 */
app.delete('/api/gastos-transversales/:id', (req, res) => {
  const result = db.prepare('DELETE FROM gastos_transversales WHERE id = ?').run(req.params.id)
  if (result.changes === 0) return res.status(404).json({ error: 'No encontrado' })
  res.json({ ok: true })
})

// ═══════════════════════════════════════════════════════════════════════════════
// ASIGNACIONES DEL MES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @openapi
 * /api/asignaciones:
 *   get:
 *     tags: [Asignaciones]
 *     summary: Lista asignaciones, opcionalmente filtradas por mes y año
 *     parameters:
 *       - in: query
 *         name: mes
 *         schema: { type: integer }
 *       - in: query
 *         name: anio
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Array de asignaciones
 */
app.get('/api/asignaciones', (req, res) => {
  const { mes, anio } = req.query
  let rows
  if (mes && anio) {
    rows = db.prepare('SELECT * FROM asignaciones_mes WHERE mes = ? AND año = ? ORDER BY creado_en')
               .all(parseInt(mes), parseInt(anio))
  } else {
    rows = db.prepare('SELECT * FROM asignaciones_mes ORDER BY año DESC, mes DESC, creado_en').all()
  }
  res.json(rows.map(rowToAsignacion))
})

/**
 * @openapi
 * /api/asignaciones:
 *   post:
 *     tags: [Asignaciones]
 *     summary: Registra una asignación mensual de servicio
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [mes, año, servicioId, servicioNombre, monto, asignadoA]
 *     responses:
 *       201:
 *         description: Asignación registrada
 */
app.post('/api/asignaciones', (req, res) => {
  const a = req.body
  const id = `asig-${uid()}`
  db.prepare(`INSERT INTO asignaciones_mes (id, mes, año, servicio_id, servicio_nombre, monto, asignado_a, pagado, fecha_pago)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, a.mes, a.año, a.servicioId, a.servicioNombre, a.monto, a.asignadoA, a.pagado ? 1 : 0, a.fechaPago ?? null)
  res.status(201).json({ ok: true, id })
})

/**
 * @openapi
 * /api/asignaciones/{id}:
 *   patch:
 *     tags: [Asignaciones]
 *     summary: Actualiza el estado de pago de una asignación
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               pagado:    { type: boolean }
 *               fechaPago: { type: string }
 *               monto:     { type: number }
 *     responses:
 *       200:
 *         description: Asignación actualizada
 *       404:
 *         description: No encontrada
 */
app.patch('/api/asignaciones/:id', (req, res) => {
  const { pagado, fechaPago, monto, asignadoA } = req.body
  const fields = []
  const params = []
  if (pagado !== undefined) { fields.push('pagado = ?'); params.push(pagado ? 1 : 0) }
  if (fechaPago !== undefined) { fields.push('fecha_pago = ?'); params.push(fechaPago) }
  if (monto !== undefined) { fields.push('monto = ?'); params.push(monto) }
  if (asignadoA !== undefined) { fields.push('asignado_a = ?'); params.push(asignadoA) }
  if (fields.length === 0) return res.status(400).json({ error: 'Nada que actualizar' })
  params.push(req.params.id)
  const result = db.prepare(`UPDATE asignaciones_mes SET ${fields.join(', ')} WHERE id = ?`).run(...params)
  if (result.changes === 0) return res.status(404).json({ error: 'No encontrada' })
  res.json({ ok: true })
})

/**
 * @openapi
 * /api/asignaciones/{id}:
 *   delete:
 *     tags: [Asignaciones]
 *     summary: Elimina una asignación mensual
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Asignación eliminada
 *       404:
 *         description: No encontrada
 */
app.delete('/api/asignaciones/:id', (req, res) => {
  const result = db.prepare('DELETE FROM asignaciones_mes WHERE id = ?').run(req.params.id)
  if (result.changes === 0) return res.status(404).json({ error: 'No encontrada' })
  res.json({ ok: true })
})

// ─── Gastos Únicos (biblioteca) ───────────────────────────────────────────────

function rowToGastoUnico(r) {
  return { id: r.id, nombre: r.nombre, categoria: r.categoria, montoRef: r.monto_ref, comentario: r.comentario ?? '' }
}

function rowToUso(r) {
  return {
    id: r.id, gastoUnicoId: r.gasto_unico_id, gastoNombre: r.gasto_nombre,
    gastoCate: r.gasto_categoria, mes: r.mes, año: r.año,
    monto: r.monto, asignadoA: r.asignado_a, pagado: r.pagado === 1, fechaPago: r.fecha_pago,
  }
}

app.get('/api/gastos-unicos', (_req, res) => {
  res.json(db.prepare('SELECT * FROM gastos_unicos ORDER BY nombre').all().map(rowToGastoUnico))
})

app.post('/api/gastos-unicos', (req, res) => {
  const g = req.body
  const id = `gu-${uid()}`
  db.prepare('INSERT INTO gastos_unicos (id, nombre, categoria, monto_ref, comentario) VALUES (?, ?, ?, ?, ?)')
    .run(id, g.nombre, g.categoria ?? 'otro', g.montoRef ?? null, (g.comentario ?? '').toString().slice(0, 100))
  res.status(201).json({ ok: true, id })
})

app.put('/api/gastos-unicos/:id', (req, res) => {
  const g = req.body
  const result = db.prepare('UPDATE gastos_unicos SET nombre=?, categoria=?, monto_ref=?, comentario=? WHERE id=?')
    .run(g.nombre, g.categoria ?? 'otro', g.montoRef ?? null, (g.comentario ?? '').toString().slice(0, 100), req.params.id)
  if (result.changes === 0) return res.status(404).json({ error: 'No encontrado' })
  res.json({ ok: true })
})

app.delete('/api/gastos-unicos/:id', (req, res) => {
  const result = db.prepare('DELETE FROM gastos_unicos WHERE id = ?').run(req.params.id)
  if (result.changes === 0) return res.status(404).json({ error: 'No encontrado' })
  res.json({ ok: true })
})

// ─── Usos de Gastos Únicos (instancias por mes) ───────────────────────────────

app.get('/api/usos-gasto-unico', (req, res) => {
  const { mes, anio } = req.query
  const rows = (mes && anio)
    ? db.prepare('SELECT * FROM usos_gasto_unico WHERE mes = ? AND año = ? ORDER BY creado_en').all(parseInt(mes), parseInt(anio))
    : db.prepare('SELECT * FROM usos_gasto_unico ORDER BY año DESC, mes DESC, creado_en').all()
  res.json(rows.map(rowToUso))
})

app.post('/api/usos-gasto-unico', (req, res) => {
  const u = req.body
  const id = `uso-${uid()}`
  db.prepare(`INSERT INTO usos_gasto_unico (id, gasto_unico_id, gasto_nombre, gasto_categoria, mes, año, monto, asignado_a, pagado, fecha_pago)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, u.gastoUnicoId, u.gastoNombre, u.gastoCate ?? 'otro', u.mes, u.año,
         u.monto, u.asignadoA ?? 'ambos', u.pagado ? 1 : 0, u.fechaPago ?? null)
  res.status(201).json({ ok: true, id })
})

app.patch('/api/usos-gasto-unico/:id', (req, res) => {
  const { monto, asignadoA, pagado, fechaPago } = req.body
  const fields = [], params = []
  if (monto !== undefined)     { fields.push('monto = ?');      params.push(monto) }
  if (asignadoA !== undefined) { fields.push('asignado_a = ?'); params.push(asignadoA) }
  if (pagado !== undefined)    { fields.push('pagado = ?');     params.push(pagado ? 1 : 0) }
  if (fechaPago !== undefined) { fields.push('fecha_pago = ?'); params.push(fechaPago) }
  if (fields.length === 0) return res.status(400).json({ error: 'Nada que actualizar' })
  params.push(req.params.id)
  const result = db.prepare(`UPDATE usos_gasto_unico SET ${fields.join(', ')} WHERE id = ?`).run(...params)
  if (result.changes === 0) return res.status(404).json({ error: 'No encontrado' })
  res.json({ ok: true })
})

app.delete('/api/usos-gasto-unico/:id', (req, res) => {
  const result = db.prepare('DELETE FROM usos_gasto_unico WHERE id = ?').run(req.params.id)
  if (result.changes === 0) return res.status(404).json({ error: 'No encontrado' })
  res.json({ ok: true })
})

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICACIONES POR EMAIL
// ═══════════════════════════════════════════════════════════════════════════════

const MESES_NOTIF = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                     'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

async function getSmtpTransporter() {
  const secrets = await vaultRead('smtp')
  if (!secrets?.host || !secrets?.user || !secrets?.pass) return null
  const nodemailer = require('nodemailer')
  const port = parseInt(secrets.port || '587')
  return nodemailer.createTransport({
    host: secrets.host,
    port,
    secure: port === 465,
    auth: { user: secrets.user, pass: secrets.pass },
  })
}

function esMesActivoNotif(s, mes) {
  if (s.periodicidad !== 'personalizado') return true
  if (s.mes_inicio && s.mes_fin) return mes >= s.mes_inicio && mes <= s.mes_fin
  return true
}

function emailHtml(titulo, subtitulo, filas, pie) {
  const filasHtml = filas.map(f => `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb">${f.nombre}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;white-space:nowrap">${f.monto}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;white-space:nowrap">${f.estado}</td>
    </tr>`).join('')

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:system-ui,sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <div style="background:#1e40af;padding:24px 28px">
      <p style="margin:0;color:#bfdbfe;font-size:12px;letter-spacing:.05em;text-transform:uppercase">Gastos Familiares</p>
      <h1 style="margin:6px 0 0;color:#fff;font-size:20px;font-weight:700">${titulo}</h1>
      <p style="margin:6px 0 0;color:#93c5fd;font-size:14px">${subtitulo}</p>
    </div>
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:#f9fafb">
          <th style="padding:10px 14px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Servicio</th>
          <th style="padding:10px 14px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Monto</th>
          <th style="padding:10px 14px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Vencimiento</th>
        </tr>
      </thead>
      <tbody>${filasHtml}</tbody>
    </table>
    <div style="padding:18px 28px;background:#f9fafb;border-top:1px solid #e5e7eb">
      <p style="margin:0;font-size:13px;color:#6b7280">${pie}</p>
    </div>
  </div>
</body></html>`
}

async function enviarNotificaciones() {
  const transporter = await getSmtpTransporter()
  if (!transporter) return

  const smtpSecrets = await vaultRead('smtp')
  const smtpFrom = smtpSecrets?.from || smtpSecrets?.user || ''

  const now  = new Date()
  const hoy  = now.getDate()
  const mes  = now.getMonth() + 1
  const anio = now.getFullYear()
  const mesNombre = MESES_NOTIF[mes - 1]

  // Emails configurados (solo los que tienen notificaciones activas)
  const cfgRows = db.prepare('SELECT clave, valor FROM config').all()
  const cfg = Object.fromEntries(cfgRows.map(r => [r.clave, r.valor]))
  const emails = [
    cfg.persona1_notificaciones !== '0' ? cfg.persona1_email : null,
    cfg.persona2_notificaciones !== '0' ? cfg.persona2_email : null,
  ].filter(e => e && e.includes('@'))
  if (emails.length === 0) return

  const moneda = cfg.moneda ?? 'PEN'

  // Servicios activos con día de vencimiento
  const servicios = db.prepare('SELECT * FROM servicios WHERE activo = 1 AND dia_vencimiento IS NOT NULL').all()

  const avisos3dias   = []
  const avisosVencido = []

  for (const s of servicios) {
    if (!esMesActivoNotif(s, mes)) continue
    const dia = s.dia_vencimiento

    // 3 días antes
    if (hoy === dia - 3) {
      const yaEnviado = db.prepare(
        "SELECT 1 FROM notificaciones_enviadas WHERE tipo='3dias' AND servicio_id=? AND mes=? AND año=?"
      ).get(s.id, mes, anio)
      if (!yaEnviado) {
        const sv = rowToServicio(s)
        avisos3dias.push({
          nombre: sv.nombre,
          monto:  sv.tipoGasto === 'fijo' && sv.montoFijo != null ? `${moneda} ${sv.montoFijo.toLocaleString('es-PE')}` : 'Variable',
          estado: `Día ${dia} (faltan 3 días)`,
        })
        db.prepare("INSERT INTO notificaciones_enviadas (id, tipo, servicio_id, mes, año) VALUES (?,?,?,?,?)")
          .run(`notif-${uid()}`, '3dias', s.id, mes, anio)
      }
    }

    // Día siguiente al vencimiento → vencido (solo si no pagado)
    if (hoy === dia + 1) {
      const pagado = db.prepare(
        "SELECT 1 FROM asignaciones_mes WHERE servicio_id=? AND mes=? AND año=? AND pagado=1"
      ).get(s.id, mes, anio)
      if (!pagado) {
        const yaEnviado = db.prepare(
          "SELECT 1 FROM notificaciones_enviadas WHERE tipo='vencido' AND servicio_id=? AND mes=? AND año=?"
        ).get(s.id, mes, anio)
        if (!yaEnviado) {
          const sv = rowToServicio(s)
          avisosVencido.push({
            nombre: sv.nombre,
            monto:  sv.tipoGasto === 'fijo' && sv.montoFijo != null ? `${moneda} ${sv.montoFijo.toLocaleString('es-PE')}` : 'Variable',
            estado: `Venció el día ${dia}`,
          })
          db.prepare("INSERT INTO notificaciones_enviadas (id, tipo, servicio_id, mes, año) VALUES (?,?,?,?,?)")
            .run(`notif-${uid()}`, 'vencido', s.id, mes, anio)
        }
      }
    }
  }

  const destino = emails.join(', ')

  if (avisos3dias.length > 0) {
    await transporter.sendMail({
      from: `"Gastos Familiares" <${smtpFrom}>`,
      to: destino,
      subject: `⚠️ ${avisos3dias.length} pago${avisos3dias.length > 1 ? 's' : ''} vence${avisos3dias.length > 1 ? 'n' : ''} en 3 días — ${mesNombre} ${anio}`,
      html: emailHtml(
        'Pagos próximos a vencer',
        `Vencen el ${hoy + 2} de ${mesNombre} de ${anio}`,
        avisos3dias,
        'Realiza los pagos antes de la fecha de vencimiento para evitar cargos adicionales.'
      ),
    })
    console.log(`[Email] Aviso 3 días enviado a ${destino}: ${avisos3dias.map(a => a.nombre).join(', ')}`)
  }

  if (avisosVencido.length > 0) {
    await transporter.sendMail({
      from: `"Gastos Familiares" <${smtpFrom}>`,
      to: destino,
      subject: `🚨 ${avisosVencido.length} pago${avisosVencido.length > 1 ? 's' : ''} venci${avisosVencido.length > 1 ? 'eron' : 'ó'} ayer — ${mesNombre} ${anio}`,
      html: emailHtml(
        'Pagos vencidos',
        `Vencieron el ${hoy - 1} de ${mesNombre} de ${anio} y no están marcados como pagados`,
        avisosVencido,
        'Marca los pagos como realizados en el dashboard una vez que los hayas completado.'
      ),
    })
    console.log(`[Email] Aviso vencido enviado a ${destino}: ${avisosVencido.map(a => a.nombre).join(', ')}`)
  }
}

// Endpoint manual para disparar el check real (útil para probar sin esperar las 8 AM)
app.post('/api/notificaciones/check', async (_req, res) => {
  try {
    await enviarNotificaciones()
    res.json({ ok: true, mensaje: 'Check de notificaciones ejecutado — revisa los logs del servidor' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Endpoint de prueba: envía un email de ejemplo independientemente de las fechas
app.post('/api/notificaciones/test', async (_req, res) => {
  const transporter = await getSmtpTransporter()
  if (!transporter) {
    return res.status(503).json({ error: 'SMTP no configurado. Configura las credenciales en Configuración → SMTP.' })
  }
  const smtpSecrets = await vaultRead('smtp')
  const smtpFrom = smtpSecrets?.from || smtpSecrets?.user || ''
  const cfgRows = db.prepare('SELECT clave, valor FROM config').all()
  const cfg = Object.fromEntries(cfgRows.map(r => [r.clave, r.valor]))
  const emails = [
    cfg.persona1_notificaciones !== '0' ? cfg.persona1_email : null,
    cfg.persona2_notificaciones !== '0' ? cfg.persona2_email : null,
  ].filter(e => e && e.includes('@'))
  if (emails.length === 0) {
    return res.status(400).json({ error: 'No hay correos con notificaciones activas. Actívalas en Configuración → General.' })
  }
  try {
    const destino = emails.join(', ')
    await transporter.sendMail({
      from: `"Gastos Familiares" <${smtpFrom}>`,
      to: destino,
      subject: '✅ Prueba de notificaciones — Gastos Familiares',
      html: emailHtml(
        'Email de prueba',
        'Las notificaciones están configuradas correctamente',
        [
          { nombre: 'Ejemplo: Scotiabank', monto: 'PEN 2,500', estado: 'Vence en 3 días (día 10)' },
          { nombre: 'Ejemplo: Sedapal', monto: 'Variable', estado: 'Venció ayer (día 6)' },
        ],
        `Recibirás notificaciones reales en los días que corresponda. Correos configurados: ${destino}`
      ),
    })
    console.log(`[Email] Prueba enviada a ${destino}`)
    res.json({ ok: true, mensaje: `Email de prueba enviado a ${destino}` })
  } catch (err) {
    console.error('[Email] Error en prueba:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ─── Secrets / SMTP (via Vault) ───────────────────────────────────────────────

app.get('/api/secrets/smtp', async (_req, res) => {
  const secrets = await vaultRead('smtp')
  if (!secrets) return res.json({ configurado: false })
  res.json({
    configurado: !!(secrets.host && secrets.user && secrets.pass),
    host: secrets.host || '',
    port: secrets.port || '587',
    user: secrets.user || '',
    pass: secrets.pass ? '••••••••' : '',
    from: secrets.from || '',
  })
})

app.put('/api/secrets/smtp', async (req, res) => {
  const { host, port, user, pass, from } = req.body
  if (!host || !user) {
    return res.status(400).json({ error: 'host y user son requeridos' })
  }
  const existing = (await vaultRead('smtp')) || {}
  const newSecrets = {
    host: host.trim(),
    port: (port || '587').toString().trim(),
    user: user.trim(),
    pass: pass && pass.trim() ? pass.trim() : (existing.pass || ''),
    from: (from || '').trim() || user.trim(),
  }
  const ok = await vaultWrite('smtp', newSecrets)
  if (!ok) return res.status(500).json({ error: 'No se pudo guardar en Vault' })
  console.log(`[Vault] SMTP actualizado: ${newSecrets.host}:${newSecrets.port} (${newSecrets.user})`)
  res.json({ ok: true })
})

// Cron: ejecutar todos los días a las 8:00 AM (hora del servidor/contenedor)
const cron = require('node-cron')
cron.schedule('0 8 * * *', () => {
  console.log('[Cron] Ejecutando check de notificaciones...')
  enviarNotificaciones().catch(err => console.error('[Email] Error al enviar:', err.message))
})
console.log('[Cron] Notificaciones programadas: diariamente a las 08:00')

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Gastos Familiares DB API → http://localhost:${PORT}`)
  console.log(`Swagger docs           → http://localhost:${PORT}/api-docs`)
  console.log(`SQLite path            → ${DB_PATH}`)
})
