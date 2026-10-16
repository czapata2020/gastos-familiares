import { beforeAll, describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gastos-plantilla-')), 'gastos.db')

let repo: typeof import('@/lib/repo')
let pl: typeof import('@/lib/plantilla')
const ANIO = 2025  // año pasado: todas las filas pre-llenadas vienen como pagadas

beforeAll(async () => {
  repo = await import('@/lib/repo')
  pl = await import('@/lib/plantilla')
  repo.setPersona({ id: '1', nombre: 'Cesar Z.', email: '', telefono: '' })
  repo.setPersona({ id: '2', nombre: 'Rudy P.', email: '', telefono: '' })
  const [r] = repo.listRepartos()
  repo.guardarReparto({ ...r, desde: `${ANIO}-01`, salario1: 6000, salario2: 4000 })
  const base = { asignadoDefault: 'ambos' as const, diaVencimiento: null, mesesActivos: [], mesesCuotaDoble: [], nota: '', activo: true, desde: null, hasta: null }
  repo.guardarConcepto({ ...base, nombre: 'Hipoteca BCP', categoria: 'vivienda', tipo: 'fijo', montoRef: 3200 })
  repo.guardarConcepto({ ...base, nombre: 'Nana', categoria: 'hogar', tipo: 'fijo', montoRef: 1500 })
  repo.guardarConcepto({ ...base, nombre: 'Luz del Sur', categoria: 'servicios', tipo: 'variable', montoRef: null })
  repo.guardarConcepto({ ...base, nombre: 'Internet', categoria: 'servicios', tipo: 'fijo', montoRef: 159, asignadoDefault: '1' })
})

async function abrir(buf: Buffer | ArrayBuffer) {
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf as ArrayBuffer); return wb
}
const aBuffer = async (wb: ExcelJS.Workbook) => (await wb.xlsx.writeBuffer()) as ArrayBuffer
const filaDe = (h: ExcelJS.Worksheet, mes: string, gasto: string) => {
  let out: ExcelJS.Row | null = null
  h.eachRow((r, n) => { if (n > 1 && r.getCell(3).value === mes && r.getCell(4).value === gasto) out = r })
  return out as unknown as ExcelJS.Row
}

describe('plantilla Excel', () => {
  it('se genera pre-llenada con los recurrentes del rango', async () => {
    const wb = await abrir(await pl.generarPlantilla(ANIO, 1, 3))
    const h = wb.getWorksheet('Gastos')!
    expect(h.getRow(1).values).toEqual([, 'ID', 'Año', 'Mes', 'Gasto', 'Categoría', 'Monto', 'Quién paga', 'Pagado', 'Nota'])
    expect(h.actualRowCount).toBe(1 + 4 * 3)
    const hip = filaDe(h, 'Enero', 'Hipoteca BCP')
    expect([hip.getCell(6).value, hip.getCell(7).value, hip.getCell(8).value]).toEqual([3200, '', 'Sí'])
    expect(filaDe(h, 'Febrero', 'Internet').getCell(7).value).toBe('Cesar')
    expect(filaDe(h, 'Marzo', 'Luz del Sur').getCell(6).value ?? '').toBe('')
  })

  it('previsualiza, detecta errores e importa con asignación automática', async () => {
    const wb = await abrir(await pl.generarPlantilla(ANIO, 1, 3))
    const h = wb.getWorksheet('Gastos')!
    filaDe(h, 'Enero', 'Luz del Sur').getCell(6).value = 186.4
    filaDe(h, 'Febrero', 'Luz del Sur').getCell(6).value = '201,30'
    h.addRow(['', ANIO, 'Marzo', 'Regalo cumpleaños', 'Otro', 250, 'Rudy', 'Sí', 'Cumple de la abuela'])
    const malo = h.addRow(['', ANIO, 'Marzo', 'Médico', 'Salud', 'mucho', '', '', ''])

    let plan = await pl.planificarImportacion(await aBuffer(wb))
    expect(plan.errores).toEqual([{ fila: malo.number, mensaje: 'Monto inválido: "mucho"' }])
    expect(() => pl.aplicarImportacion(plan)).toThrow()
    expect(plan.omitidas).toBe(1)  // luz de marzo sin monto

    malo.getCell(6).value = 120
    plan = await pl.planificarImportacion(await aBuffer(wb))
    expect(plan.errores).toEqual([])
    expect(plan.resumen).toMatchObject({ crear: 3 * 3 + 2 + 2, actualizar: 0 })
    expect(plan.filas.find(f => f.nombre === 'Regalo cumpleaños')?.aviso).toContain('ocasional')

    expect(pl.aplicarImportacion(plan)).toEqual({ creados: 13, actualizados: 0, borrados: 0 })
    const ene = repo.listPagos(ANIO, 1)
    expect(ene.every(p => p.pagado)).toBe(true)
    expect(ene.filter(p => p.tipo !== 'ocasional').every(p => p.asignadoA !== 'ambos')).toBe(true)
    expect(ene.find(p => p.nombre === 'Internet')).toMatchObject({ asignadoA: '1', asignacionManual: false })
    expect(repo.listPagos(ANIO, 2).find(p => p.nombre === 'Luz del Sur')?.monto).toBe(201.3)
    expect(repo.listPagos(ANIO, 3).find(p => p.nombre === 'Regalo cumpleaños')).toMatchObject({ tipo: 'ocasional', asignadoA: '2', nota: 'Cumple de la abuela' })
  })

  it('reimportar lo exportado actualiza sin duplicar ni mover pagos ya asignados', async () => {
    const antes = repo.listPagos(ANIO)
    const wb = await abrir(await pl.generarPlantilla(ANIO, 1, 3))
    const h = wb.getWorksheet('Gastos')!
    filaDe(h, 'Enero', 'Nana').getCell(6).value = 1600
    const plan = await pl.planificarImportacion(await aBuffer(wb))
    expect(plan.errores).toEqual([])
    expect(plan.resumen.crear).toBe(0)
    pl.aplicarImportacion(plan)
    const despues = repo.listPagos(ANIO)
    expect(despues).toHaveLength(antes.length)
    expect(despues.find(p => p.nombre === 'Nana' && p.mes === 1)?.monto).toBe(1600)
    for (const p of antes) expect(despues.find(x => x.id === p.id)?.asignadoA).toBe(p.asignadoA)
  })

  it('borrón y cuenta nueva: reemplaza los meses del archivo, sin duplicar ocasionales y recalculando pagados', async () => {
    const enero = repo.listPagos(ANIO, 1)
    const marzoAntes = repo.listPagos(ANIO, 3).length
    // fijamos a mano un pago pagado de enero para ver que el borrón lo recalcula
    repo.actualizarPago(enero.find(p => p.nombre === 'Hipoteca BCP')!.id, { asignadoA: 'ambos' })
    const wb = await abrir(await pl.generarPlantilla(ANIO, 1, 2))
    const h = wb.getWorksheet('Gastos')!
    h.eachRow((r, n) => { if (n > 1) { r.getCell(1).value = ''; r.getCell(7).value = 'Auto' } })  // sin IDs, todo en Auto
    const plan = await pl.planificarImportacion(await aBuffer(wb), true)
    expect(plan.errores).toEqual([])
    expect(plan.resumen.actualizar).toBe(0)
    expect(plan.resumen.borrar).toBe(enero.length + repo.listPagos(ANIO, 2).length)
    const r = pl.aplicarImportacion(plan)
    expect(r.borrados).toBe(plan.resumen.borrar)
    const eneroDespues = repo.listPagos(ANIO, 1)
    expect(eneroDespues).toHaveLength(enero.length)
    expect(eneroDespues.find(p => p.nombre === 'Hipoteca BCP')!.asignadoA).not.toBe('ambos')
    expect(repo.listPagos(ANIO, 3)).toHaveLength(marzoAntes)  // marzo no estaba en el archivo: intacto
  })

  it('un gasto renombrado después de descargar la plantilla sigue siendo recurrente', async () => {
    const wb = await abrir(await pl.generarPlantilla(ANIO, 4, 4))
    const nana = repo.listConceptos().find(c => c.nombre === 'Nana')!
    repo.guardarConcepto({ ...nana, nombre: 'Nana Margarita' })        // renombrado en Ajustes
    const h = wb.getWorksheet('Gastos')!
    h.addRow(['', ANIO, 'Abril', 'Pasajes Cusco', 'Transporte', 900, '', 'Sí', ''])
    const plan = await pl.planificarImportacion(await aBuffer(wb))
    const filaNana = plan.filas.find(f => f.conceptoId === nana.id)!
    expect(filaNana).toMatchObject({ tipo: 'fijo', nombre: 'Nana Margarita', aviso: 'Se toma como "Nana Margarita"' })
    expect(plan.nuevos).toEqual(['Pasajes Cusco'])
  })

  it('recalcular un mes incluye los pagados y conserva que están pagados', async () => {
    const pagosMar = () => repo.listPagos(ANIO, 3).filter(p => p.tipo !== 'ocasional')
    for (const p of pagosMar()) repo.actualizarPago(p.id, { asignadoA: '1', pagado: true })   // todo a mano a la persona 1
    expect(pagosMar().every(p => p.asignadoA === '1' && p.asignacionManual && p.pagado)).toBe(true)
    repo.automatizarMes(ANIO, 3, true)
    const despues = pagosMar()
    expect(despues.every(p => p.pagado && !p.asignacionManual)).toBe(true)
    expect(despues.some(p => p.asignadoA === '2')).toBe(true)
  })

  it('rechaza archivos que no son la plantilla', async () => {
    await expect(pl.planificarImportacion(new TextEncoder().encode('hola').buffer as ArrayBuffer)).rejects.toThrow('.xlsx')
    const wb = new ExcelJS.Workbook(); wb.addWorksheet('x').addRow(['a', 'b'])
    await expect(pl.planificarImportacion(await aBuffer(wb))).rejects.toThrow('Faltan columnas')
  })
})
