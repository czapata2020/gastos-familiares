import type { Asignacion, Concepto, FilaMes, Pago, Reparto } from '@/types'

export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
export const MESES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export const claveMes = (anio: number, mes: number) => `${anio}-${String(mes).padStart(2, '0')}`

/** Reparto vigente para un mes: el periodo más reciente con desde <= mes. */
export function repartoVigente(repartos: Reparto[], anio: number, mes: number): Reparto | null {
  const k = claveMes(anio, mes)
  const vigentes = repartos.filter(r => r.desde <= k).sort((a, b) => b.desde.localeCompare(a.desde))
  if (vigentes.length) return vigentes[0]
  // Antes del primer periodo registrado se usa el más antiguo, para no dejar meses sin reparto.
  return [...repartos].sort((a, b) => a.desde.localeCompare(b.desde))[0] ?? null
}

/**
 * % que le toca a la persona 1 según salarios convertidos a moneda base.
 * Misma regla que la versión anterior: si la moneda del salario no es la base, se multiplica por tipoCambio.
 */
export function porcentajePersona1(r: Reparto | null, monedaBase: string): number {
  if (!r) return 50
  if (r.porcentajeManual != null) return Math.min(100, Math.max(0, r.porcentajeManual))
  const toBase = (s: number, m: string) => (m === monedaBase ? s : s * r.tipoCambio)
  const s1 = toBase(r.salario1, r.moneda1)
  const s2 = toBase(r.salario2, r.moneda2)
  const total = s1 + s2
  return total > 0 ? (s1 / total) * 100 : 50
}

/** Cuánto le corresponde a cada persona de un monto según a quién se asignó. */
export function dividir(monto: number, asignadoA: Asignacion, pct1: number): [number, number] {
  if (asignadoA === '1') return [monto, 0]
  if (asignadoA === '2') return [0, monto]
  const p1 = (monto * pct1) / 100
  return [p1, monto - p1]
}

export function conceptoActivoEnMes(c: Concepto, mes: number): boolean {
  if (!c.activo || c.tipo === 'ocasional') return false
  return c.mesesActivos.length === 0 || c.mesesActivos.includes(mes)
}

export function montoSugerido(c: Concepto, mes: number): number | null {
  if (c.montoRef == null) return null
  return c.mesesCuotaDoble.includes(mes) ? c.montoRef * 2 : c.montoRef
}

/** Une conceptos recurrentes del mes con los pagos ya registrados. */
export function armarFilas(conceptos: Concepto[], pagos: Pago[], mes: number): FilaMes[] {
  const porConcepto = new Map(pagos.filter(p => p.conceptoId).map(p => [p.conceptoId!, p]))
  const filas: FilaMes[] = []
  const usados = new Set<string>()

  for (const c of conceptos) {
    const pago = porConcepto.get(c.id) ?? null
    if (!pago && !conceptoActivoEnMes(c, mes)) continue
    if (pago) usados.add(pago.id)
    filas.push({
      key: pago?.id ?? `c:${c.id}`,
      pago,
      concepto: c,
      nombre: pago?.nombre ?? c.nombre,
      categoria: pago?.categoria ?? c.categoria,
      tipo: c.tipo,
      montoSugerido: montoSugerido(c, mes),
      esCuotaDoble: c.mesesCuotaDoble.includes(mes),
      diaVencimiento: c.diaVencimiento,
    })
  }
  for (const p of pagos) {
    if (usados.has(p.id)) continue
    const c = conceptos.find(x => x.id === p.conceptoId) ?? null
    filas.push({
      key: p.id, pago: p, concepto: c, nombre: p.nombre, categoria: p.categoria, tipo: p.tipo,
      montoSugerido: null, esCuotaDoble: false, diaVencimiento: c?.diaVencimiento ?? null,
    })
  }
  const orden = { fijo: 0, variable: 1, ocasional: 2 }
  return filas.sort((a, b) => orden[a.tipo] - orden[b.tipo]
    || (a.diaVencimiento ?? 99) - (b.diaVencimiento ?? 99)
    || a.nombre.localeCompare(b.nombre))
}

export type EstadoVencimiento = 'pagado' | 'vencido' | 'por-vencer' | 'pendiente' | 'sin-registrar'

export function estadoFila(f: FilaMes, anio: number, mes: number, hoy = new Date()): EstadoVencimiento {
  if (f.pago?.pagado) return 'pagado'
  const dia = f.diaVencimiento
  const hoyK = hoy.getFullYear() * 12 + hoy.getMonth()
  const filaK = anio * 12 + (mes - 1)
  if (dia && (filaK < hoyK || (filaK === hoyK && hoy.getDate() > dia))) return 'vencido'
  if (dia && filaK === hoyK && dia - hoy.getDate() <= 5) return 'por-vencer'
  return f.pago ? 'pendiente' : 'sin-registrar'
}
