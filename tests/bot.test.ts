import { beforeAll, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Base temporal propia antes de importar nada que abra la base
process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gastos-bot-')), 'gastos.db')

const CESAR = '51900000001', RUDY = '51900000002'
let bot: typeof import('@/lib/bot/bot')
let repo: typeof import('@/lib/repo')
const hoy = new Date()
const anio = hoy.getFullYear(), mes = hoy.getMonth() + 1

beforeAll(async () => {
  repo = await import('@/lib/repo')
  bot = await import('@/lib/bot/bot')
  repo.setPersona({ id: '1', nombre: 'Cesar Z.', email: '', telefono: '+51 900 000 001' })
  repo.setPersona({ id: '2', nombre: 'Rudy P.', email: '', telefono: RUDY })
  const [r] = repo.listRepartos()
  repo.guardarReparto({ ...r, desde: `${anio}-01`, salario1: 6000, salario2: 4000 })
  const base = { categoria: 'servicios' as const, asignadoDefault: 'ambos' as const, diaVencimiento: null, mesesActivos: [], mesesCuotaDoble: [], nota: '', activo: true, desde: null, hasta: null }
  repo.guardarConcepto({ ...base, nombre: 'Luz del Sur', tipo: 'variable', montoRef: 180 })
  repo.guardarConcepto({ ...base, nombre: 'Hipoteca BCP', tipo: 'fijo', montoRef: 3200, categoria: 'vivienda' })
})

const idDe = (r: { botones?: { id: string }[] }, prefijo: string) => r.botones!.find(b => b.id.startsWith(prefijo + ':'))!.id
const pagoDe = (nombre: string) => repo.getEstadoMes(anio, mes).filas.find(f => f.nombre === nombre)?.pago

describe('bot de WhatsApp', () => {
  it('ignora números que no están en Ajustes', () => {
    expect(bot.procesarMensaje('51999999999', 'luz 186')).toEqual([])
  })

  it('propone, guarda como pagado y respeta la asignación automática', () => {
    const [p] = bot.procesarMensaje(CESAR, 'luz 186')
    expect(p.texto).toContain('Luz del Sur')
    expect(p.texto).toContain('automático')
    expect(p.botones).toHaveLength(3)
    const [ok] = bot.procesarMensaje(CESAR, '', idDe(p, 'gp'))
    expect(ok.texto).toContain('Guardado')
    expect(pagoDe('Luz del Sur')).toMatchObject({ monto: 186, pagado: true, asignacionManual: false })
    expect(pagoDe('Luz del Sur')!.asignadoA).not.toBe('ambos')
  })

  it('un botón no se puede usar dos veces', () => {
    const [p] = bot.procesarMensaje(RUDY, 'luz 190')
    expect(p.texto).toContain('antes')
    bot.procesarMensaje(RUDY, '', idDe(p, 'x'))
    expect(bot.procesarMensaje(RUDY, '', idDe(p, 'g'))[0].texto).toContain('ya no está vigente')
    expect(pagoDe('Luz del Sur')!.monto).toBe(186)
  })

  it('un botón de otra persona no aplica', () => {
    const [p] = bot.procesarMensaje(RUDY, 'luz 200')
    expect(bot.procesarMensaje(CESAR, '', idDe(p, 'g'))[0].texto).toContain('ya no está vigente')
  })

  it('un gasto nuevo es ocasional y "yo" lo asigna a quien escribe', () => {
    const [p] = bot.procesarMensaje(RUDY, 'farmacia 85 yo')
    expect(p.texto).toContain('gasto nuevo')
    bot.procesarMensaje(RUDY, '', idDe(p, 'g'))
    expect(pagoDe('Farmacia')).toMatchObject({ tipo: 'ocasional', monto: 85, asignadoA: '2', pagado: false })
  })

  it('pagué la hipoteca la registra con su monto de referencia', () => {
    expect(bot.procesarMensaje(CESAR, 'pagué la hipoteca')[0].texto).toContain('registrado y pagado')
    expect(pagoDe('Hipoteca BCP')).toMatchObject({ monto: 3200, pagado: true })
    expect(bot.procesarMensaje(CESAR, 'pague hipoteca')[0].texto).toContain('ya estaba pagado')
  })

  it('resumen, pendientes y mensajes que no entiende', () => {
    expect(bot.procesarMensaje(CESAR, 'resumen')[0].texto).toMatch(/Total: \*S\/\s?3,471\.00\*/)
    expect(bot.procesarMensaje(CESAR, 'pendientes')[0].texto).toContain('Farmacia')
    expect(bot.procesarMensaje(CESAR, 'qué tal')[0].texto).toContain('No te entendí')
  })
})
