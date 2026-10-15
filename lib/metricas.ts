import type { Categoria, Pago, Reparto } from '@/types'
import { dividir, porcentajePersona1, repartoVigente } from './reparto'

export interface MetricaMes {
  mes: number
  total: number
  persona1: number
  persona2: number
  /** Lo que le tocaba a la persona 1 si todo se repartiera por salario. */
  justo1: number
  pct1: number
  fijo: number
  variable: number
  ocasional: number
  registros: number
}

export interface Variacion {
  nombre: string
  actual: number
  promedio: number
  delta: number
}

export interface Metricas {
  anio: number
  meses: MetricaMes[]
  acumulado: number
  promedio: number
  mesesConDatos: number
  porCategoria: { categoria: Categoria; total: number }[]
  /** Positivo: la persona 1 cargó más de lo que le tocaba; la persona 2 le debe ese monto. */
  balance1: number
  real1: number
  justo1: number
  variaciones: Variacion[]
}

export function calcularMetricas(pagos: Pago[], repartos: Reparto[], monedaBase: string, anio: number, mesFoco: number): Metricas {
  const meses: MetricaMes[] = Array.from({ length: 12 }, (_, i) => {
    const pct1 = porcentajePersona1(repartoVigente(repartos, anio, i + 1), monedaBase)
    return { mes: i + 1, total: 0, persona1: 0, persona2: 0, justo1: 0, pct1, fijo: 0, variable: 0, ocasional: 0, registros: 0 }
  })
  const cat = new Map<Categoria, number>()

  for (const p of pagos) {
    if (p.anio !== anio) continue
    const m = meses[p.mes - 1]
    const [a, b] = dividir(p.monto, p.asignadoA, m.pct1)
    m.total += p.monto
    m.persona1 += a
    m.persona2 += b
    m.justo1 += (p.monto * m.pct1) / 100
    m[p.tipo] += p.monto
    m.registros++
    cat.set(p.categoria, (cat.get(p.categoria) ?? 0) + p.monto)
  }

  const conDatos = meses.filter(m => m.registros > 0)
  const acumulado = conDatos.reduce((s, m) => s + m.total, 0)
  const real1 = conDatos.reduce((s, m) => s + m.persona1, 0)
  const justo1 = conDatos.reduce((s, m) => s + m.justo1, 0)

  // Variación por concepto: mes en foco vs promedio de los meses anteriores del año en que apareció.
  const porNombre = new Map<string, Map<number, number>>()
  for (const p of pagos) {
    if (p.anio !== anio) continue
    const key = p.conceptoId ?? p.nombre
    const mm = porNombre.get(key) ?? new Map<number, number>()
    mm.set(p.mes, (mm.get(p.mes) ?? 0) + p.monto)
    porNombre.set(key, mm)
  }
  const nombres = new Map(pagos.map(p => [p.conceptoId ?? p.nombre, p.nombre]))
  const variaciones: Variacion[] = []
  for (const [key, mm] of porNombre) {
    const actual = mm.get(mesFoco)
    const previos = [...mm.entries()].filter(([k]) => k < mesFoco).map(([, v]) => v)
    if (actual == null || previos.length === 0) continue
    const promedio = previos.reduce((s, v) => s + v, 0) / previos.length
    if (Math.abs(actual - promedio) < 0.5) continue
    variaciones.push({ nombre: nombres.get(key) ?? key, actual, promedio, delta: actual - promedio })
  }
  variaciones.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

  return {
    anio, meses, acumulado,
    promedio: conDatos.length ? acumulado / conDatos.length : 0,
    mesesConDatos: conDatos.length,
    porCategoria: [...cat.entries()].map(([categoria, total]) => ({ categoria, total })).sort((a, b) => b.total - a.total),
    balance1: real1 - justo1, real1, justo1,
    variaciones: variaciones.slice(0, 6),
  }
}
