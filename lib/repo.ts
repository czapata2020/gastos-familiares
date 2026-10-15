import 'server-only'
import type { Asignacion, Categoria, Concepto, Config, EstadoMes, Pago, Persona, Reparto, TipoConcepto } from '@/types'
import { getDb, uid } from './db'
import { armarFilas, porcentajePersona1, repartoVigente } from './reparto'
import { calcularMetricas } from './metricas'

type Row = Record<string, any>
const json = (s: string): number[] => { try { const v = JSON.parse(s); return Array.isArray(v) ? v : [] } catch { return [] } }

const toConcepto = (r: Row): Concepto => ({
  id: r.id, nombre: r.nombre, categoria: r.categoria, tipo: r.tipo, montoRef: r.monto_ref,
  asignadoDefault: r.asignado_default, diaVencimiento: r.dia_vencimiento,
  mesesActivos: json(r.meses_activos), mesesCuotaDoble: json(r.meses_cuota_doble),
  nota: r.nota, activo: r.activo === 1,
})
const toPago = (r: Row): Pago => ({
  id: r.id, conceptoId: r.concepto_id, nombre: r.nombre, categoria: r.categoria, tipo: r.tipo,
  anio: r.anio, mes: r.mes, monto: r.monto, asignadoA: r.asignado_a, pagado: r.pagado === 1,
  fechaPago: r.fecha_pago, nota: r.nota,
})
const toReparto = (r: Row): Reparto => ({
  id: r.id, desde: r.desde, salario1: r.salario1, moneda1: r.moneda1, salario2: r.salario2,
  moneda2: r.moneda2, tipoCambio: r.tipo_cambio, porcentajeManual: r.porcentaje_manual,
})

// ── Config y personas ─────────────────────────────────────────────────────────

export function getConfig(): Config {
  const r = getDb().prepare("SELECT valor FROM config WHERE clave = 'moneda'").get() as Row | undefined
  return { monedaBase: r?.valor || 'PEN' }
}
export function setConfig(c: Config) {
  getDb().prepare("INSERT OR REPLACE INTO config (clave, valor) VALUES ('moneda', ?)").run(c.monedaBase)
}
export function getPersonas(): [Persona, Persona] {
  const rows = getDb().prepare('SELECT * FROM personas ORDER BY id').all() as Persona[]
  return [rows[0], rows[1]]
}
export function setPersona(p: Persona) {
  getDb().prepare('UPDATE personas SET nombre = ?, email = ? WHERE id = ?').run(p.nombre.trim(), p.email.trim().toLowerCase(), p.id)
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
                     meses_activos, meses_cuota_doble, nota, activo)
                   VALUES (@id, @nombre, @categoria, @tipo, @montoRef, @asignadoDefault, @diaVencimiento,
                     @mesesActivos, @mesesCuotaDoble, @nota, @activo)
                   ON CONFLICT(id) DO UPDATE SET nombre=@nombre, categoria=@categoria, tipo=@tipo, monto_ref=@montoRef,
                     asignado_default=@asignadoDefault, dia_vencimiento=@diaVencimiento, meses_activos=@mesesActivos,
                     meses_cuota_doble=@mesesCuotaDoble, nota=@nota, activo=@activo`)
    .run({
      ...c, id, nombre: c.nombre.trim(), montoRef: c.montoRef ?? null, diaVencimiento: c.diaVencimiento ?? null,
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
}

export function crearPago(p: NuevoPago): string {
  const id = uid('pag')
  getDb().prepare(`INSERT INTO pagos (id, concepto_id, nombre, categoria, tipo, anio, mes, monto, asignado_a, pagado, fecha_pago, nota)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT DO NOTHING`)
    .run(id, p.conceptoId ?? null, p.nombre.trim(), p.categoria, p.tipo, p.anio, p.mes, p.monto, p.asignadoA,
      p.pagado ? 1 : 0, p.pagado ? hoyISO() : null, p.nota ?? '')
  // Si ya existía el pago recurrente de ese mes (doble toque, dos personas a la vez), devolvemos el existente.
  if (p.conceptoId && p.tipo !== 'ocasional') {
    const r = getDb().prepare('SELECT id FROM pagos WHERE concepto_id = ? AND anio = ? AND mes = ?').get(p.conceptoId, p.anio, p.mes) as Row
    return r.id
  }
  return id
}

export function actualizarPago(id: string, patch: Partial<Pick<Pago, 'monto' | 'asignadoA' | 'pagado' | 'nota' | 'nombre'>>) {
  const sets: string[] = []
  const params: Record<string, unknown> = { id }
  if (patch.monto !== undefined) { sets.push('monto = @monto'); params.monto = patch.monto }
  if (patch.asignadoA !== undefined) { sets.push('asignado_a = @asignadoA'); params.asignadoA = patch.asignadoA }
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
}

export function borrarPago(id: string) {
  getDb().prepare('DELETE FROM pagos WHERE id = ?').run(id)
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
      crearPago({
        conceptoId: f.concepto.id, nombre: f.nombre, categoria: f.categoria, tipo: f.tipo, anio, mes, monto,
        asignadoA: previo?.asignadoA ?? f.concepto.asignadoDefault,
      })
      n++
    }
  })()
  return n
}

// ── Vistas compuestas ─────────────────────────────────────────────────────────

export function getEstadoMes(anio: number, mes: number): EstadoMes {
  const config = getConfig()
  const conceptos = listConceptos(true)
  const pct1 = porcentajePersona1(repartoVigente(listRepartos(), anio, mes), config.monedaBase)
  return {
    anio, mes, config, personas: getPersonas(), porcentaje1: pct1,
    filas: armarFilas(conceptos.filter(c => c.activo || c.tipo !== 'ocasional'), listPagos(anio, mes), mes),
    ocasionales: conceptos.filter(c => c.tipo === 'ocasional' && c.activo),
  }
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
