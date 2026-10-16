import type { Asignacion, Concepto, FilaMes, Pago, PersonaId, Reparto } from '@/types'

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

export function conceptoActivoEnMes(c: Concepto, anio: number, mes: number): boolean {
  if (!c.activo || c.tipo === 'ocasional') return false
  const k = claveMes(anio, mes)
  if ((c.desde && k < c.desde) || (c.hasta && k > c.hasta)) return false
  return c.mesesActivos.length === 0 || c.mesesActivos.includes(mes)
}

/** Recurrente cuyo último mes ya pasó: deja de aparecer y se muestra como finalizado. */
export function conceptoFinalizado(c: Concepto, hoy = new Date()): boolean {
  return !!c.hasta && c.hasta < claveMes(hoy.getFullYear(), hoy.getMonth() + 1)
}

export function montoSugerido(c: Concepto, mes: number): number | null {
  if (c.montoRef == null) return null
  return c.mesesCuotaDoble.includes(mes) ? c.montoRef * 2 : c.montoRef
}

/** Une conceptos recurrentes del mes con los pagos ya registrados. */
export function armarFilas(conceptos: Concepto[], pagos: Pago[], anio: number, mes: number): FilaMes[] {
  const porConcepto = new Map(pagos.filter(p => p.conceptoId).map(p => [p.conceptoId!, p]))
  const filas: FilaMes[] = []
  const usados = new Set<string>()

  for (const c of conceptos) {
    const pago = porConcepto.get(c.id) ?? null
    if (!pago && !conceptoActivoEnMes(c, anio, mes)) continue
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
      asignacionSugerida: null,
    })
  }
  for (const p of pagos) {
    if (usados.has(p.id)) continue
    const c = conceptos.find(x => x.id === p.conceptoId) ?? null
    filas.push({
      key: p.id, pago: p, concepto: c, nombre: p.nombre, categoria: p.categoria, tipo: p.tipo,
      montoSugerido: null, esCuotaDoble: false, diaVencimiento: c?.diaVencimiento ?? null, asignacionSugerida: null,
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

/** Monto con el que cuenta una fila: lo registrado o, si aún no se registra, el sugerido. */
export const montoFila = (f: FilaMes) => f.pago?.monto ?? f.montoSugerido

export interface ContextoAsignacion {
  /** Cuánto de más (+) o de menos (−) cargó la persona 1 en los meses anteriores del año, sobre lo que le tocaba. */
  arrastre1?: number
  /** Total gastado en los meses anteriores del año (para medir el desvío en puntos del acumulado). */
  totalPrevio?: number
  /** Quién pagó cada gasto recurrente la última vez (conceptoId → persona): base para mantener los grupos. */
  previo?: Map<string, PersonaId>
  /** Monto a usar cuando un recurrente aún no tiene monto ni referencia (el último registrado). */
  montoRespaldo?: Map<string, number>
  /** Desvío aceptado del acumulado del año antes de mover un gasto de persona (0.03 = 3 puntos). */
  tolerancia?: number
}

export const TOLERANCIA_AUTO = 0.03
/** Hasta cuántos gastos libres se prueban todas las combinaciones (2^18 ≈ 262 mil: unos milisegundos). */
const MAX_EXHAUSTIVO = 18

/**
 * Asignación automática con grupos de responsabilidad estables: cada recurrente va completo a una
 * persona y se queda con quien lo pagó el mes anterior. Solo si el acumulado del año se desvía del %
 * de ingreso más que la tolerancia, se mueven gastos (de a uno, el que más acerca) hasta volver a ella.
 *
 * Quedan fijos (cuentan para el total pero no se mueven): los pagados, los elegidos a mano, los
 * configurados para una persona y los ocasionales registrados.
 */
export function asignacionAutomatica(filas: FilaMes[], pct1: number, arrastreOCtx: number | ContextoAsignacion = 0): Map<string, PersonaId> {
  const ctx: ContextoAsignacion = typeof arrastreOCtx === 'number' ? { arrastre1: arrastreOCtx } : arrastreOCtx
  const arrastre1 = ctx.arrastre1 ?? 0
  const tolerancia = ctx.tolerancia ?? TOLERANCIA_AUTO
  const monto = (f: FilaMes) => montoFila(f) ?? (f.concepto ? ctx.montoRespaldo?.get(f.concepto.id) : undefined) ?? 0

  let total = 0, cargado1 = 0
  const libres: FilaMes[] = []
  for (const f of filas) {
    const m = monto(f)
    if (f.tipo === 'ocasional' || !f.concepto) {
      if (f.pago) { total += m; cargado1 += dividir(m, f.pago.asignadoA, pct1)[0] }
      continue
    }
    total += m
    const preferido = f.concepto.asignadoDefault
    const fija = f.pago?.pagado || f.pago?.asignacionManual ? f.pago.asignadoA : preferido !== 'ambos' ? preferido : null
    if (fija) cargado1 += dividir(m, fija, pct1)[0]
    else libres.push(f)
  }

  // Desvío del acumulado del año para la persona 1 (positivo: cargó de más)
  const objetivoMes1 = (total * pct1) / 100
  const desvio = (c1: number) => arrastre1 + c1 - objetivoMes1
  const limite = tolerancia * ((ctx.totalPrevio ?? 0) + total)

  const out = new Map<string, PersonaId>()
  const suma = () => [...out.entries()].reduce((s, [k, q]) => s + (q === '1' ? monto(libres.find(f => f.key === k)!) : 0), 0)

  // 1) Mantener el grupo: cada gasto con quien lo pagó la última vez
  const nuevos: FilaMes[] = []
  for (const f of libres) {
    const antes = ctx.previo?.get(f.concepto!.id)
    if (antes) out.set(f.key, antes)
    else nuevos.push(f)
  }
  // 2) Los que no tienen historia: de mayor a menor, a quien esté más atrás de su objetivo
  for (const f of nuevos.sort((x, y) => monto(y) - monto(x) || x.nombre.localeCompare(y.nombre))) {
    const d = desvio(cargado1 + suma())
    out.set(f.key, d > 0 ? '2' : '1')
  }
  // 3) Si el año se sale de la tolerancia, buscar el reparto que vuelva a ella cambiando la menor
  //    cantidad de gastos. Con pocos gastos se prueban todas las combinaciones; si son muchos, se
  //    mueve de a un gasto (el que más acerca) hasta volver.
  if (Math.abs(desvio(cargado1 + suma())) <= limite) return out
  const base = libres.map(f => out.get(f.key)!)
  const montos = libres.map(monto)

  if (libres.length <= MAX_EXHAUSTIVO) {
    let mejorMask = -1, mejorCambios = Infinity, mejorD = Infinity, dentro = false
    for (let mask = 0; mask < 1 << libres.length; mask++) {   // bit en 1 = persona 1
      let c1 = cargado1, cambios = 0
      for (let k = 0; k < libres.length; k++) {
        const q = mask & (1 << k) ? '1' : '2'
        if (q === '1') c1 += montos[k]
        if (q !== base[k]) cambios++
      }
      const d = Math.abs(desvio(c1))
      const ok = d <= limite
      // dentro de la tolerancia: gana el que menos cambia; si ninguno entra: el más cercano al objetivo
      const mejora = ok ? (!dentro || cambios < mejorCambios || (cambios === mejorCambios && d < mejorD))
                        : (!dentro && (d < mejorD - 0.005 || (Math.abs(d - mejorD) <= 0.005 && cambios < mejorCambios)))
      if (mejora) { mejorMask = mask; mejorCambios = cambios; mejorD = d; dentro = dentro || ok }
    }
    libres.forEach((f, k) => out.set(f.key, mejorMask & (1 << k) ? '1' : '2'))
    return out
  }

  for (let vueltas = 0; vueltas < libres.length; vueltas++) {
    const d = desvio(cargado1 + suma())
    if (Math.abs(d) <= limite) break
    const desde: PersonaId = d > 0 ? '1' : '2'
    let mejor: FilaMes | null = null, mejorD = Math.abs(d)
    for (const f of libres) {
      if (out.get(f.key) !== desde) continue
      const nd = Math.abs(d + (desde === '1' ? -monto(f) : monto(f)))
      if (nd < mejorD - 0.005) { mejorD = nd; mejor = f }
    }
    if (!mejor) break
    out.set(mejor.key, desde === '1' ? '2' : '1')
  }
  return out
}
