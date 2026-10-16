import 'server-only'
import type { Asignacion, Categoria, Concepto, Config, EstadoMes, Pago, Persona, Reparto, TipoConcepto } from '@/types'
import { getDb, uid } from './db'
import { armarFilas, asignacionAutomatica, dividir, porcentajePersona1, repartoVigente } from './reparto'
import { calcularMetricas } from './metricas'

type Row = Record<string, any>
const json = (s: string): number[] => { try { const v = JSON.parse(s); return Array.isArray(v) ? v : [] } catch { return [] } }

const toConcepto = (r: Row): Concepto => ({
  id: r.id, nombre: r.nombre, categoria: r.categoria, tipo: r.tipo, montoRef: r.monto_ref,
  asignadoDefault: r.asignado_default, diaVencimiento: r.dia_vencimiento,
  mesesActivos: json(r.meses_activos), mesesCuotaDoble: json(r.meses_cuota_doble),
  nota: r.nota, activo: r.activo === 1, desde: r.desde ?? null, hasta: r.hasta ?? null,
})
const toPago = (r: Row): Pago => ({
  id: r.id, conceptoId: r.concepto_id, nombre: r.nombre, categoria: r.categoria, tipo: r.tipo,
  anio: r.anio, mes: r.mes, monto: r.monto, asignadoA: r.asignado_a, pagado: r.pagado === 1,
  fechaPago: r.fecha_pago, nota: r.nota, asignacionManual: r.asignacion_manual === 1,
})
const toReparto = (r: Row): Reparto => ({
  id: r.id, desde: r.desde, salario1: r.salario1, moneda1: r.moneda1, salario2: r.salario2,
  moneda2: r.moneda2, tipoCambio: r.tipo_cambio, porcentajeManual: r.porcentaje_manual,
})

// ── Config y personas ─────────────────────────────────────────────────────────

export function getConfig(): Config {
  const m = Object.fromEntries((getDb().prepare("SELECT clave, valor FROM config WHERE clave IN ('moneda', 'asignacion_auto')").all() as Row[]).map(r => [r.clave, r.valor]))
  return { monedaBase: m.moneda || 'PEN', asignacionAuto: m.asignacion_auto !== '0' }
}
export function setConfig(c: Partial<Config>) {
  const up = getDb().prepare('INSERT OR REPLACE INTO config (clave, valor) VALUES (?, ?)')
  if (c.monedaBase !== undefined) up.run('moneda', c.monedaBase)
  if (c.asignacionAuto !== undefined) up.run('asignacion_auto', c.asignacionAuto ? '1' : '0')
}
export function getPersonas(): [Persona, Persona] {
  const rows = (getDb().prepare('SELECT * FROM personas ORDER BY id').all() as Row[]).map(r => ({
    id: r.id, nombre: r.nombre, email: r.email, telefono: r.telefono ?? '', waUserId: r.wa_user_id ?? '',
  }) as Persona)
  return [rows[0], rows[1]]
}
export function setPersona(p: Omit<Persona, 'waUserId'>) {
  getDb().prepare('UPDATE personas SET nombre = ?, email = ?, telefono = ? WHERE id = ?')
    .run(p.nombre.trim(), p.email.trim().toLowerCase(), soloDigitos(p.telefono ?? ''), p.id)
}

export const soloDigitos = (s: string) => s.replace(/\D/g, '')

/** El ID de WhatsApp (BSUID) tiene la forma "PE.123…": país, punto y alfanuméricos. */
export const esUserId = (id: string) => /^[A-Z]{2}\.[A-Za-z0-9.]+$/.test(id)

/** Quién escribe: por ID de WhatsApp (BSUID) si viene así, o por número de teléfono. */
export function personaPorRemitente(remitente: string): Persona | null {
  if (!remitente) return null
  if (esUserId(remitente)) return getPersonas().find(p => p.waUserId === remitente) ?? null
  const tel = soloDigitos(remitente)
  return getPersonas().find(p => p.telefono && p.telefono === tel) ?? null
}
/** @deprecated usar personaPorRemitente */
export const personaPorTelefono = personaPorRemitente

export function guardarWaUserId(personaId: string, userId: string) {
  getDb().prepare('UPDATE personas SET wa_user_id = ? WHERE id = ?').run(userId, personaId)
}

/** Código de 6 dígitos, válido 15 minutos, para que una persona vincule su WhatsApp escribiendo "vincular <código>". */
export function crearCodigoVinculo(personaId: string): string {
  const db = getDb()
  db.prepare("DELETE FROM wa_vinculos WHERE expira_en < datetime('now') OR persona_id = ?").run(personaId)
  let codigo = ''
  do { codigo = String(Math.floor(100000 + Math.random() * 900000)) } while (db.prepare('SELECT 1 FROM wa_vinculos WHERE codigo = ?').get(codigo))
  db.prepare("INSERT INTO wa_vinculos (codigo, persona_id, expira_en) VALUES (?, ?, datetime('now', '+15 minutes'))").run(codigo, personaId)
  return codigo
}

/** Usa un código: si es válido, vincula el ID de WhatsApp a la persona y lo consume. */
export function usarCodigoVinculo(codigo: string, userId: string): Persona | null {
  const db = getDb()
  const fila = db.prepare("SELECT persona_id FROM wa_vinculos WHERE codigo = ? AND expira_en >= datetime('now')").get(codigo) as Row | undefined
  if (!fila) return null
  db.prepare('DELETE FROM wa_vinculos WHERE codigo = ?').run(codigo)
  guardarWaUserId(fila.persona_id, userId)
  return getPersonas().find(p => p.id === fila.persona_id) ?? null
}

// ── Repartos ──────────────────────────────────────────────────────────────────

export function listRepartos(): Reparto[] {
  return (getDb().prepare('SELECT * FROM repartos ORDER BY desde DESC').all() as Row[]).map(toReparto)
}
export function guardarReparto(r: Omit<Reparto, 'id'> & { id?: string }) {
  const db = getDb()
  const id = r.id ?? uid('rep')
  db.prepare(`INSERT INTO repartos (id, desde, salario1, moneda1, salario2, moneda2, tipo_cambio, porcentaje_manual)
              VALUES (@id, @desde, @salario1, @moneda1, @salario2, @moneda2, @tipoCambio, @porcentajeManual)
              ON CONFLICT(id) DO UPDATE SET desde=@desde, salario1=@salario1, moneda1=@moneda1, salario2=@salario2,
                moneda2=@moneda2, tipo_cambio=@tipoCambio, porcentaje_manual=@porcentajeManual`)
    .run({ ...r, id, porcentajeManual: r.porcentajeManual ?? null })
  return id
}
export function borrarReparto(id: string) {
  const db = getDb()
  if ((db.prepare('SELECT COUNT(*) n FROM repartos').get() as Row).n <= 1) throw new Error('Debe quedar al menos un periodo de salarios')
  db.prepare('DELETE FROM repartos WHERE id = ?').run(id)
}

// ── Conceptos ─────────────────────────────────────────────────────────────────

export function listConceptos(incluirInactivos = false): Concepto[] {
  const sql = incluirInactivos ? 'SELECT * FROM conceptos ORDER BY nombre' : 'SELECT * FROM conceptos WHERE activo = 1 ORDER BY nombre'
  return (getDb().prepare(sql).all() as Row[]).map(toConcepto)
}
export function guardarConcepto(c: Omit<Concepto, 'id'> & { id?: string }) {
  const id = c.id ?? uid('con')
  getDb().prepare(`INSERT INTO conceptos (id, nombre, categoria, tipo, monto_ref, asignado_default, dia_vencimiento,
                     meses_activos, meses_cuota_doble, nota, activo, desde, hasta)
                   VALUES (@id, @nombre, @categoria, @tipo, @montoRef, @asignadoDefault, @diaVencimiento,
                     @mesesActivos, @mesesCuotaDoble, @nota, @activo, @desde, @hasta)
                   ON CONFLICT(id) DO UPDATE SET nombre=@nombre, categoria=@categoria, tipo=@tipo, monto_ref=@montoRef,
                     asignado_default=@asignadoDefault, dia_vencimiento=@diaVencimiento, meses_activos=@mesesActivos,
                     meses_cuota_doble=@mesesCuotaDoble, nota=@nota, activo=@activo, desde=@desde, hasta=@hasta`)
    .run({
      ...c, id, nombre: c.nombre.trim(), montoRef: c.montoRef ?? null, diaVencimiento: c.diaVencimiento ?? null,
      desde: c.desde ?? null, hasta: c.hasta ?? null,
      mesesActivos: JSON.stringify(c.mesesActivos ?? []), mesesCuotaDoble: JSON.stringify(c.mesesCuotaDoble ?? []),
      nota: c.nota ?? '', activo: c.activo === false ? 0 : 1,
    })
  return id
}
/** Los conceptos con pagos se archivan (no se borran) para no perder historia. */
export function borrarConcepto(id: string) {
  const db = getDb()
  const usado = db.prepare('SELECT 1 FROM pagos WHERE concepto_id = ? LIMIT 1').get(id)
  if (usado) db.prepare('UPDATE conceptos SET activo = 0 WHERE id = ?').run(id)
  else db.prepare('DELETE FROM conceptos WHERE id = ?').run(id)
}

// ── Pagos ─────────────────────────────────────────────────────────────────────

export function listPagos(anio: number, mes?: number): Pago[] {
  const db = getDb()
  const rows = mes
    ? db.prepare('SELECT * FROM pagos WHERE anio = ? AND mes = ? ORDER BY creado_en').all(anio, mes)
    : db.prepare('SELECT * FROM pagos WHERE anio = ? ORDER BY mes, creado_en').all(anio)
  return (rows as Row[]).map(toPago)
}

export interface NuevoPago {
  conceptoId?: string | null
  nombre: string
  categoria: Categoria
  tipo: TipoConcepto
  anio: number
  mes: number
  monto: number
  asignadoA: Asignacion
  pagado?: boolean
  nota?: string
  asignacionManual?: boolean
}

export function crearPago(p: NuevoPago, rebalancear = true): string {
  const id = uid('pag')
  getDb().prepare(`INSERT INTO pagos (id, concepto_id, nombre, categoria, tipo, anio, mes, monto, asignado_a, pagado, fecha_pago, nota, asignacion_manual)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT DO NOTHING`)
    .run(id, p.conceptoId ?? null, p.nombre.trim(), p.categoria, p.tipo, p.anio, p.mes, p.monto, p.asignadoA,
      p.pagado ? 1 : 0, p.pagado ? hoyISO() : null, p.nota ?? '', p.asignacionManual ? 1 : 0)
  if (p.tipo === 'ocasional' || !p.conceptoId) return id
  if (rebalancear) rebalancearMes(p.anio, p.mes)
  // Si ya existía el pago recurrente de ese mes (doble toque, dos personas a la vez), devolvemos el existente.
  const r = getDb().prepare('SELECT id FROM pagos WHERE concepto_id = ? AND anio = ? AND mes = ?').get(p.conceptoId, p.anio, p.mes) as Row
  return r.id
}

export function actualizarPago(id: string, patch: Partial<Pick<Pago, 'monto' | 'asignadoA' | 'pagado' | 'nota' | 'nombre'>> & { automatico?: boolean }) {
  const sets: string[] = []
  const params: Record<string, unknown> = { id }
  if (patch.monto !== undefined) { sets.push('monto = @monto'); params.monto = patch.monto }
  // Elegir a mano a quién le toca fija el pago; "automático" lo devuelve a la regla.
  if (patch.asignadoA !== undefined) { sets.push('asignado_a = @asignadoA', 'asignacion_manual = 1'); params.asignadoA = patch.asignadoA }
  else if (patch.automatico) sets.push('asignacion_manual = 0')
  if (patch.nota !== undefined) { sets.push('nota = @nota'); params.nota = patch.nota }
  if (patch.nombre !== undefined) { sets.push('nombre = @nombre'); params.nombre = patch.nombre.trim() }
  if (patch.pagado !== undefined) {
    sets.push('pagado = @pagado', 'fecha_pago = @fechaPago')
    params.pagado = patch.pagado ? 1 : 0
    params.fechaPago = patch.pagado ? hoyISO() : null
  }
  if (!sets.length) return
  sets.push("actualizado_en = datetime('now')")
  getDb().prepare(`UPDATE pagos SET ${sets.join(', ')} WHERE id = @id`).run(params)
  const p = getDb().prepare('SELECT anio, mes, tipo FROM pagos WHERE id = ?').get(id) as Row | undefined
  if (p && p.tipo !== 'ocasional') rebalancearMes(p.anio, p.mes)
}

export function borrarPago(id: string) {
  const p = getDb().prepare('SELECT anio, mes, tipo FROM pagos WHERE id = ?').get(id) as Row | undefined
  getDb().prepare('DELETE FROM pagos WHERE id = ?').run(id)
  if (p && p.tipo !== 'ocasional') rebalancearMes(p.anio, p.mes)
}

/**
 * Devuelve a la regla automática los recurrentes del mes. Por defecto solo los no pagados;
 * con `incluirPagados` también recalcula los pagados (útil al cargar meses pasados de cero).
 */
export function automatizarMes(anio: number, mes: number, incluirPagados = false): number {
  const db = getDb()
  if (!incluirPagados) {
    db.prepare("UPDATE pagos SET asignacion_manual = 0 WHERE anio = ? AND mes = ? AND tipo <> 'ocasional' AND pagado = 0").run(anio, mes)
    return rebalancearMes(anio, mes)
  }
  let n = 0
  db.transaction(() => {
    const pagados = (db.prepare("SELECT id FROM pagos WHERE anio = ? AND mes = ? AND tipo <> 'ocasional' AND pagado = 1").all(anio, mes) as Row[]).map(r => r.id as string)
    // sin pagar un instante para que la regla pueda moverlos; la fecha de pago se conserva
    db.prepare("UPDATE pagos SET asignacion_manual = 0, pagado = 0 WHERE anio = ? AND mes = ? AND tipo <> 'ocasional'").run(anio, mes)
    n = rebalancearMes(anio, mes)
    const volver = db.prepare('UPDATE pagos SET pagado = 1 WHERE id = ?')
    for (const id of pagados) volver.run(id)
  })()
  return n
}

/**
 * Con la asignación automática activa, vuelve a repartir los recurrentes registrados del mes que
 * no están pagados ni fijados a mano. Los ocasionales nunca se tocan.
 */
export function rebalancearMes(anio: number, mes: number): number {
  if (!getConfig().asignacionAuto) return 0
  const estado = getEstadoMes(anio, mes)
  const upd = getDb().prepare("UPDATE pagos SET asignado_a = ?, actualizado_en = datetime('now') WHERE id = ?")
  let n = 0
  getDb().transaction(() => {
    for (const f of estado.filas) {
      if (!f.pago || !f.asignacionSugerida || f.pago.asignadoA === f.asignacionSugerida) continue
      upd.run(f.asignacionSugerida, f.pago.id)
      n++
    }
  })()
  return n
}

/** Registra de una vez todos los recurrentes del mes que aún no tienen pago, con su monto sugerido. */
export function registrarPendientes(anio: number, mes: number, origen: 'sugerido' | 'mes-anterior'): number {
  const estado = getEstadoMes(anio, mes)
  const [pa, pm] = mes === 1 ? [anio - 1, 12] : [anio, mes - 1]
  const anteriores = origen === 'mes-anterior' ? listPagos(pa, pm) : []
  let n = 0
  getDb().transaction(() => {
    for (const f of estado.filas) {
      if (f.pago || !f.concepto) continue
      const previo = anteriores.find(p => p.conceptoId === f.concepto!.id)
      const monto = previo?.monto ?? f.montoSugerido
      if (monto == null) continue
      const auto = estado.config.asignacionAuto
      crearPago({
        conceptoId: f.concepto.id, nombre: f.nombre, categoria: f.categoria, tipo: f.tipo, anio, mes, monto,
        asignadoA: (auto ? f.asignacionSugerida : previo?.asignadoA) ?? f.concepto.asignadoDefault,
        asignacionManual: !auto ? false : previo?.asignacionManual ?? false,
      }, false)
      n++
    }
  })()
  rebalancearMes(anio, mes)
  return n
}

// ── Vistas compuestas ─────────────────────────────────────────────────────────

export function getEstadoMes(anio: number, mes: number): EstadoMes {
  const config = getConfig()
  const conceptos = listConceptos(true)
  const pct1 = porcentajePersona1(repartoVigente(listRepartos(), anio, mes), config.monedaBase)
  const filas = armarFilas(conceptos.filter(c => c.activo || c.tipo !== 'ocasional'), listPagos(anio, mes), anio, mes)
  const arrastre1 = arrastreAnual(anio, mes, config.monedaBase)
  if (config.asignacionAuto) {
    const sugerida = asignacionAutomatica(filas, pct1, arrastre1)
    for (const f of filas) {
      if (!f.concepto || f.tipo === 'ocasional' || f.pago?.pagado || f.pago?.asignacionManual) continue
      const preferido = f.concepto.asignadoDefault
      f.asignacionSugerida = preferido !== 'ambos' ? preferido : sugerida.get(f.key) ?? null
    }
  }
  return {
    anio, mes, config, personas: getPersonas(), porcentaje1: pct1, arrastre1, filas,
    ocasionales: conceptos.filter(c => c.tipo === 'ocasional' && c.activo),
  }
}

/** Desvío acumulado de la persona 1 en los recurrentes de enero hasta el mes anterior (mismo año). */
function arrastreAnual(anio: number, mes: number, monedaBase: string): number {
  if (mes === 1) return 0
  const repartos = listRepartos()
  const rows = getDb().prepare("SELECT mes, monto, asignado_a FROM pagos WHERE anio = ? AND mes < ? AND tipo <> 'ocasional'").all(anio, mes) as Row[]
  let desvio = 0
  for (const r of rows) {
    const pct = porcentajePersona1(repartoVigente(repartos, anio, r.mes), monedaBase)
    desvio += dividir(r.monto, r.asignado_a, pct)[0] - (r.monto * pct) / 100
  }
  return desvio
}

export function getMetricas(anio: number, mesFoco: number) {
  const config = getConfig()
  return {
    config, personas: getPersonas(),
    metricas: calcularMetricas(listPagos(anio), listRepartos(), config.monedaBase, anio, mesFoco),
    anterior: calcularMetricas(listPagos(anio - 1), listRepartos(), config.monedaBase, anio - 1, 12),
  }
}

export function aniosConDatos(): number[] {
  const rows = getDb().prepare('SELECT DISTINCT anio FROM pagos ORDER BY anio').all() as Row[]
  const anios = new Set(rows.map(r => r.anio as number))
  anios.add(new Date().getFullYear())
  return [...anios].sort()
}

export function exportarCSV(): string {
  const rows = getDb().prepare('SELECT anio, mes, nombre, categoria, tipo, monto, asignado_a, pagado, fecha_pago, nota FROM pagos ORDER BY anio, mes, nombre').all() as Row[]
  const esc = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  const head = 'anio,mes,nombre,categoria,tipo,monto,asignado_a,pagado,fecha_pago,nota'
  return [head, ...rows.map(r => [r.anio, r.mes, r.nombre, r.categoria, r.tipo, r.monto, r.asignado_a, r.pagado, r.fecha_pago, r.nota].map(esc).join(','))].join('\n')
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}
