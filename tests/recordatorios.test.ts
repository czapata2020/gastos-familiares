import { beforeAll, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gastos-recordatorios-')), 'gastos.db')

// Meta simulada: registra los envíos en vez de mandarlos
const envios: { para: string; params: string[] }[] = []
let estado = 'APPROVED'
vi.mock('@/lib/whatsapp', () => ({
  whatsappConfigurado: () => true,
  estadoPlantilla: async () => estado,
  enviarPlantilla: async (para: string, _n: string, params: string[]) => { envios.push({ para, params }) },
}))

let repo: typeof import('@/lib/repo')
let notif: typeof import('@/lib/notificaciones')
const HOY = new Date(2026, 9, 18, 9, 0)   // 18 de octubre, 9:00

beforeAll(async () => {
  repo = await import('@/lib/repo')
  notif = await import('@/lib/notificaciones')
  repo.setPersona({ id: '1', nombre: 'Cesar Z.', email: '', telefono: '51900000001' })
  repo.setPersona({ id: '2', nombre: 'Rudy P.', email: '', telefono: '' })
  repo.guardarWaUserId('2', 'PE.123456789')                         // Rudy, sin número: por su ID
  const base = { categoria: 'servicios' as const, tipo: 'fijo' as const, mesesActivos: [], mesesCuotaDoble: [], nota: '', activo: true, desde: null, hasta: null }
  repo.guardarConcepto({ ...base, nombre: 'Luz Pluz', montoRef: 183, diaVencimiento: 18, asignadoDefault: '2' })      // hoy, Rudy
  repo.guardarConcepto({ ...base, nombre: 'Hipoteca', montoRef: 5719.34, diaVencimiento: 21, asignadoDefault: '1' })  // en 3 días, Cesar
  repo.guardarConcepto({ ...base, nombre: 'Internet', montoRef: 89, diaVencimiento: 17, asignadoDefault: 'ambos' })   // ayer, los dos
  repo.guardarConcepto({ ...base, nombre: 'Netflix', montoRef: 50, diaVencimiento: 25, asignadoDefault: '2' })        // falta: no avisa
  // Internet registrado a mano como "Ambos": el aviso va a los dos
  const internet = repo.listConceptos().find(c => c.nombre === 'Internet')!
  repo.crearPago({ conceptoId: internet.id, nombre: 'Internet', categoria: 'servicios', tipo: 'fijo', anio: 2026, mes: 10, monto: 89, asignadoA: 'ambos', asignacionManual: true })
})

describe('recordatorios por WhatsApp', () => {
  it('no envía nada mientras la plantilla no esté aprobada', async () => {
    estado = 'PENDING'
    expect((await notif.revisarVencimientos(HOY)).whatsapp).toBe(0)
    expect(envios).toHaveLength(0)
    estado = 'APPROVED'
  })

  it('a cada persona solo lo suyo; "Ambos" a los dos; Rudy por su ID', async () => {
    expect((await notif.revisarVencimientos(HOY)).whatsapp).toBe(2)
    const cesar = envios.find(e => e.para === '51900000001')!
    const rudy = envios.find(e => e.para === 'PE.123456789')!
    expect(cesar.params[0]).toBe('Cesar')
    expect(cesar.params[1]).toMatch(/^Internet .* venció el 17\/10 · Hipoteca .* vence el 21\/10$/)
    expect(rudy.params[1]).toMatch(/^Internet .* venció el 17\/10 · Luz Pluz .* vence hoy$/)
    expect(rudy.params[1]).not.toContain('Netflix')
    expect(rudy.params[2]).toMatch(/272\.00/)
  })

  it('no repite avisos ya enviados, y no avisa lo ya pagado', async () => {
    envios.length = 0
    expect((await notif.revisarVencimientos(HOY)).whatsapp).toBe(0)
    const otroDia = new Date(2026, 9, 25, 9, 0)
    const netflix = repo.getEstadoMes(2026, 10).filas.find(f => f.nombre === 'Netflix')!
    repo.crearPago({ conceptoId: netflix.concepto!.id, nombre: 'Netflix', categoria: 'servicios', tipo: 'fijo', anio: 2026, mes: 10, monto: 50, asignadoA: '2', pagado: true })
    expect((await notif.revisarVencimientos(otroDia)).whatsapp).toBe(0)
  })
})

describe('recordatorios por correo', () => {
  it('a cada persona en su correo solo lo suyo, sin repetir', async () => {
    const correos: { to: string; subject: string; html: string }[] = []
    vi.doMock('nodemailer', () => ({ default: { createTransport: () => ({ sendMail: async (m: { to: string; subject: string; html: string }) => { correos.push(m) } }) } }))
    vi.resetModules()
    process.env.SMTP_HOST = 'smtp.ejemplo.com'; process.env.SMTP_USER = 'bot@ejemplo.com'; process.env.SMTP_PASS = 'x'
    const repo2 = await import('@/lib/repo')
    const notif2 = await import('@/lib/notificaciones')
    repo2.setPersona({ id: '1', nombre: 'Cesar Z.', email: 'cesar@ejemplo.com', telefono: '51900000001' })
    repo2.setPersona({ id: '2', nombre: 'Rudy P.', email: 'rudy@ejemplo.com', telefono: '' })
    notif2.activarWhatsApp(false)
    notif2.activarNotificaciones(true)
    expect(await notif2.revisarVencimientos(HOY)).toEqual({ whatsapp: 0, correo: 2 })
    const aRudy = correos.find(c => c.to === 'rudy@ejemplo.com')!
    expect(aRudy.html).toContain('Luz Pluz')
    expect(aRudy.html).toContain('vence hoy')
    expect(aRudy.html).not.toContain('Hipoteca')
    expect(correos.find(c => c.to === 'cesar@ejemplo.com')!.html).toContain('Hipoteca')
    expect((await notif2.revisarVencimientos(HOY)).correo).toBe(0)
  })
})
