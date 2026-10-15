import { describe, expect, it } from 'vitest'
import type { Concepto, Pago, Reparto } from '@/types'
import { armarFilas, dividir, estadoFila, porcentajePersona1, repartoVigente } from '@/lib/reparto'
import { calcularMetricas } from '@/lib/metricas'

const rep = (desde: string, s1: number, s2: number, extra: Partial<Reparto> = {}): Reparto => ({
  id: desde, desde, salario1: s1, moneda1: 'PEN', salario2: s2, moneda2: 'PEN', tipoCambio: 1, porcentajeManual: null, ...extra,
})
const concepto = (id: string, extra: Partial<Concepto> = {}): Concepto => ({
  id, nombre: id, categoria: 'hogar', tipo: 'fijo', montoRef: 100, asignadoDefault: 'ambos', diaVencimiento: null,
  mesesActivos: [], mesesCuotaDoble: [], nota: '', activo: true, ...extra,
})
const pago = (extra: Partial<Pago>): Pago => ({
  id: Math.random().toString(), conceptoId: null, nombre: 'x', categoria: 'hogar', tipo: 'fijo', anio: 2026, mes: 1,
  monto: 100, asignadoA: 'ambos', pagado: false, fechaPago: null, nota: '', ...extra,
})

describe('porcentajes por salario', () => {
  it('reparte proporcional al salario', () => {
    expect(porcentajePersona1(rep('2026-01', 6000, 4000), 'PEN')).toBeCloseTo(60)
  })
  it('convierte la moneda extranjera con el tipo de cambio (misma regla que v1)', () => {
    const r = rep('2026-01', 7400, 2000, { moneda2: 'USD', tipoCambio: 3.7 })
    expect(porcentajePersona1(r, 'PEN')).toBeCloseTo(50)
  })
  it('usa 50/50 sin salarios y respeta el % manual', () => {
    expect(porcentajePersona1(rep('2026-01', 0, 0), 'PEN')).toBe(50)
    expect(porcentajePersona1(rep('2026-01', 1, 1, { porcentajeManual: 70 }), 'PEN')).toBe(70)
  })
  it('elige el periodo vigente para cada mes', () => {
    const rs = [rep('2026-01', 1, 1), rep('2026-06', 3, 1)]
    expect(repartoVigente(rs, 2026, 5)!.desde).toBe('2026-01')
    expect(repartoVigente(rs, 2026, 6)!.desde).toBe('2026-06')
    expect(repartoVigente(rs, 2025, 12)!.desde).toBe('2026-01')
  })
})

describe('dividir', () => {
  it('asigna completo o proporcional', () => {
    expect(dividir(100, '1', 60)).toEqual([100, 0])
    expect(dividir(100, '2', 60)).toEqual([0, 100])
    expect(dividir(100, 'ambos', 60)).toEqual([60, 40])
  })
})

describe('filas del mes', () => {
  it('incluye recurrentes activos, aplica cuota doble y no duplica registrados', () => {
    const cs = [
      concepto('hip', { mesesCuotaDoble: [7] }),
      concepto('colegio', { mesesActivos: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }),
      concepto('regalo', { tipo: 'ocasional' }),
    ]
    const julio = armarFilas(cs, [pago({ conceptoId: 'hip', mes: 7, monto: 200 })], 7)
    expect(julio.map(f => f.concepto?.id)).toEqual(['colegio', 'hip'])
    expect(julio.find(f => f.concepto?.id === 'hip')!.montoSugerido).toBe(200)
    expect(julio.find(f => f.concepto?.id === 'hip')!.pago!.monto).toBe(200)
    expect(armarFilas(cs, [], 1).map(f => f.concepto?.id)).toEqual(['hip'])
  })
  it('marca vencido cuando pasó el día de vencimiento', () => {
    const [f] = armarFilas([concepto('luz', { diaVencimiento: 10 })], [], 3)
    expect(estadoFila(f, 2026, 3, new Date(2026, 2, 15))).toBe('vencido')
    expect(estadoFila(f, 2026, 3, new Date(2026, 2, 7))).toBe('por-vencer')
    expect(estadoFila(f, 2026, 4, new Date(2026, 2, 7))).toBe('sin-registrar')
  })
})

describe('métricas', () => {
  it('calcula totales, balance justo y variaciones', () => {
    const rs = [rep('2026-01', 6, 4)]
    const pagos = [
      pago({ mes: 1, monto: 1000, asignadoA: 'ambos', conceptoId: 'a', nombre: 'Luz' }),
      pago({ mes: 2, monto: 1400, asignadoA: 'ambos', conceptoId: 'a', nombre: 'Luz' }),
      pago({ mes: 2, monto: 500, asignadoA: '1', tipo: 'ocasional' }),
    ]
    const m = calcularMetricas(pagos, rs, 'PEN', 2026, 2)
    expect(m.acumulado).toBe(2900)
    expect(m.meses[1].persona1).toBeCloseTo(840 + 500)
    expect(m.real1 - m.justo1).toBeCloseTo(500 - 300) // los 500 que puso solo la persona 1, menos su 60%
    expect(m.variaciones[0]).toMatchObject({ nombre: 'Luz', actual: 1400, promedio: 1000 })
    expect(m.promedio).toBe(1450)
  })
})
