import { beforeAll, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Concepto, PersonaId } from '@/types'
import { armarFilas, asignacionAutomatica } from '@/lib/reparto'

process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gastos-grupos-')), 'gastos.db')

const concepto = (id: string, montoRef: number, extra: Partial<Concepto> = {}): Concepto => ({
  id, nombre: id, categoria: 'hogar', tipo: 'fijo', montoRef, asignadoDefault: 'ambos', diaVencimiento: null,
  mesesActivos: [], mesesCuotaDoble: [], nota: '', activo: true, desde: null, hasta: null, ...extra,
})

describe('grupos estables (función pura)', () => {
  const cs = [concepto('hipoteca', 5700), concepto('nana', 1200), concepto('alimentos', 1500), concepto('auto', 1900), concepto('luz', 200)]
  const filas = armarFilas(cs, [], 2026, 5)

  it('dentro de la tolerancia, cada gasto se queda con quien lo pagó antes', () => {
    // 5700+200 = 5900 de 10500 → 56%; objetivo 58% → desvío 2 puntos < 3
    const previo = new Map<string, PersonaId>([['hipoteca', '1'], ['luz', '1'], ['nana', '2'], ['alimentos', '2'], ['auto', '2']])
    const m = asignacionAutomatica(filas, 58, { previo, totalPrevio: 0 })
    for (const f of filas) expect(m.get(f.key)).toBe(previo.get(f.concepto!.id))
  })

  it('fuera de la tolerancia mueve lo mínimo para volver', () => {
    const previo = new Map<string, PersonaId>([['hipoteca', '2'], ['luz', '1'], ['nana', '1'], ['alimentos', '1'], ['auto', '1']])
    const m = asignacionAutomatica(filas, 58, { previo })
    const cambios = filas.filter(f => m.get(f.key) !== previo.get(f.concepto!.id))
    // Sin mover la hipoteca la persona 1 no pasa de 46%; al moverla hay que sacarle 3 gastos: 4 es el mínimo posible
    expect(cambios.length).toBe(4)
    const p1 = filas.filter(f => m.get(f.key) === '1').reduce((s, f) => s + f.montoSugerido!, 0)
    expect(Math.abs(p1 / 10500 - 0.58)).toBeLessThanOrEqual(0.03 + 1e-9)
  })

  it('un gasto sin monto igual recibe una persona (nunca "Ambos")', () => {
    const sinMonto = armarFilas([...cs, concepto('internet', 0, { montoRef: null })], [], 2026, 5)
    const m = asignacionAutomatica(sinMonto, 58, { montoRespaldo: new Map([['internet', 79]]) })
    expect(m.get(sinMonto.find(f => f.concepto!.id === 'internet')!.key)).toMatch(/^[12]$/)
  })
})

describe('un año completo con montos parecidos a los reales', () => {
  let repo: typeof import('@/lib/repo')
  beforeAll(async () => {
    repo = await import('@/lib/repo')
    const [r] = repo.listRepartos()
    repo.guardarReparto({ ...r, desde: '2026-01', salario1: 6340, salario2: 3660 })   // 63.4% / 36.6%
    const base = { categoria: 'hogar' as const, asignadoDefault: 'ambos' as const, diaVencimiento: null, mesesActivos: [], nota: '', activo: true, desde: null, hasta: null }
    const gastos: [string, number, 'fijo' | 'variable', number[]][] = [
      ['Hipoteca', 5719.34, 'fijo', [1, 7]], ['Crédito vehicular', 1885.43, 'fijo', []], ['Alimentación', 1500, 'fijo', []],
      ['Asistente del hogar', 1500, 'fijo', []], ['Nana', 1200, 'fijo', []], ['Nido', 750, 'fijo', []], ['Luz', 200, 'variable', []],
      ['Gas', 120, 'variable', []], ['Agua', 117, 'variable', []], ['Cámaras', 150, 'fijo', []], ['Beneficios', 120, 'fijo', []],
      ['Internet', 79, 'fijo', []], ['Netflix', 50, 'fijo', []], ['Vigilancia', 40, 'fijo', []],
    ]
    for (const [nombre, monto, tipo, dobles] of gastos) repo.guardarConcepto({ ...base, nombre, tipo, montoRef: monto, mesesCuotaDoble: dobles })
  })

  it('cierra el año dentro de 3 puntos y cambia pocos gastos de persona', () => {
    const asignacion: Map<string, string>[] = []
    let real1 = 0, total = 0
    for (let mes = 1; mes <= 12; mes++) {
      repo.registrarPendientes(2026, mes, 'sugerido')
      for (const p of repo.listPagos(2026, mes)) repo.actualizarPago(p.id, { pagado: true })
      const pagos = repo.listPagos(2026, mes)
      asignacion.push(new Map(pagos.map(p => [p.conceptoId!, p.asignadoA])))
      for (const p of pagos) { total += p.monto; if (p.asignadoA === '1') real1 += p.monto }
      expect(pagos.every(p => p.asignadoA !== 'ambos')).toBe(true)
    }
    let cambios = 0
    for (let i = 1; i < 12; i++) for (const [k, q] of asignacion[i]) if (asignacion[i - 1].get(k) !== q) cambios++
    // 14 gastos × 11 transiciones = 154 oportunidades de cambio
    console.log(`año: persona 1 = ${(real1 / total * 100).toFixed(1)}% (objetivo 63.4%), cambios de persona en el año: ${cambios}`)
    expect(Math.abs(real1 / total - 0.634)).toBeLessThanOrEqual(0.03)
    expect(cambios).toBeLessThanOrEqual(20)
  })
})
