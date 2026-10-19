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

  it('se puede cambiar la persona antes de guardar, y "cancelar" descarta', () => {
    const [p] = bot.procesarMensaje(RUDY, 'compras 120')
    expect(p.botones!.map(b => b.titulo)).toEqual(['Guardar', 'Guardar y pagado', 'Cambiar persona'])
    expect(p.texto).toContain('Rudy')                                       // ocasional: lo paga quien lo registra
    const [elegir] = bot.procesarMensaje(RUDY, '', idDe(p, 'c'))
    expect(elegir.botones!.map(b => b.titulo)).toEqual(['Cesar', 'Rudy', 'Ambos (por %)'])
    const [otra] = bot.procesarMensaje(RUDY, '', elegir.botones![0].id)     // Cesar
    expect(otra.texto).toMatch(/Le toca: \*Cesar\*/)
    bot.procesarMensaje(RUDY, '', idDe(otra, 'gp'))
    expect(pagoDe('Compras')).toMatchObject({ asignadoA: '1', pagado: true, tipo: 'ocasional' })
    const [q] = bot.procesarMensaje(CESAR, '180 farmacia')
    expect(q.texto).toContain('Farmacia')
    expect(bot.procesarMensaje(CESAR, 'cancelar')[0].texto).toContain('descarté')
    expect(bot.procesarMensaje(CESAR, '', idDe(q, 'g'))[0].texto).toContain('ya no está vigente')
  })

  it('compras por partes: "Sumar al mes" acumula sobre lo ya registrado', () => {
    const antes = pagoDe('Luz del Sur')!.monto
    const [p] = bot.procesarMensaje(RUDY, '50 luz')
    expect(p.texto).toContain('Sumar')
    const [ok] = bot.procesarMensaje(RUDY, '', idDe(p, 's'))
    expect(ok.texto).toContain('Guardado')
    expect(pagoDe('Luz del Sur')!.monto).toBe(antes + 50)
    const [q] = bot.procesarMensaje(RUDY, 'luz 186')
    bot.procesarMensaje(RUDY, '', idDe(q, 'g'))                 // Reemplazar
    expect(pagoDe('Luz del Sur')!.monto).toBe(186)
  })

  it('un botón no se puede usar dos veces', () => {
    const [p] = bot.procesarMensaje(RUDY, 'luz 190')
    expect(p.texto).toContain('Ya tiene')
    expect(p.botones!.map(b => b.titulo)).toEqual(['Sumar al mes', 'Reemplazar', 'Cambiar persona'])
    bot.procesarMensaje(RUDY, 'cancelar')
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

  it('vincula por código a quien Meta identifica solo con su ID de WhatsApp', () => {
    const ID = 'PE.13491208655302741918'
    expect(repo.esUserId(ID)).toBe(true)
    expect(repo.esUserId(RUDY)).toBe(false)
    expect(bot.procesarMensaje(ID, 'resumen')).toEqual([])          // desconocido: no responde
    expect(repo.usarCodigoVinculo('000000', ID)).toBeNull()          // código inválido
    const codigo = repo.crearCodigoVinculo('2')
    expect(codigo).toMatch(/^\d{6}$/)
    expect(repo.usarCodigoVinculo(codigo, ID)?.id).toBe('2')
    expect(repo.usarCodigoVinculo(codigo, 'PE.otro')).toBeNull()     // un solo uso
    expect(repo.personaPorRemitente(ID)?.nombre).toBe('Rudy P.')
    expect(repo.personaPorRemitente(RUDY)?.nombre).toBe('Rudy P.')  // el número sigue funcionando
    expect(bot.procesarMensaje(ID, 'resumen')[0].texto).toContain('Total')
  })

  it('resumen, pendientes y mensajes que no entiende', () => {
    expect(bot.procesarMensaje(CESAR, 'resumen')[0].texto).toMatch(/Total: \*S\/\s?3,591\.00\*/)
    expect(bot.procesarMensaje(CESAR, 'pendientes')[0].texto).toContain('Farmacia')
    expect(bot.procesarMensaje(CESAR, 'qué tal')[0].texto).toContain('No te entendí')
  })
})
