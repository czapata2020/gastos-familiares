import nodemailer from 'nodemailer'
import type { FilaMes, Persona, PersonaId } from '@/types'
import { getDb } from './db'
import { MESES } from './reparto'
import { getEstadoMes, getPersonas } from './repo'
import { enviarPlantilla, estadoPlantilla, whatsappConfigurado } from './whatsapp'

/**
 * Recordatorios de vencimiento, una vez al día:
 *  - WhatsApp: a cada persona, solo lo que le toca pagar (vence en 3 días, vence hoy, venció ayer).
 *    Usa la plantilla aprobada por Meta "recordatorio_pagos" (los mensajes que inicia el bot la exigen).
 *  - Correo (opcional): a la casa, 3 días antes y el día siguiente al vencimiento. SMTP_* en el servidor.
 * Cada aviso se envía una sola vez (tabla avisos_enviados).
 */

export const PLANTILLA_RECORDATORIO = 'recordatorio_pagos'

const smtpConfigurado = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)

function transporte() {
  const port = Number(process.env.SMTP_PORT ?? 587)
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST, port, secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })
}

function leerConfig(clave: string) {
  return (getDb().prepare('SELECT valor FROM config WHERE clave = ?').get(clave) as { valor: string } | undefined)?.valor
}
function guardarConfig(clave: string, valor: string) {
  getDb().prepare('INSERT OR REPLACE INTO config (clave, valor) VALUES (?, ?)').run(clave, valor)
}

function destinatariosCorreo(): string[] {
  return (getDb().prepare("SELECT email FROM personas WHERE email LIKE '%@%'").all() as { email: string }[]).map(r => r.email)
}

/** A dónde escribirle por WhatsApp: su número o, si Meta no lo comparte, su ID vinculado. */
const destinoWhatsApp = (p: Persona) => p.telefono || p.waUserId

export async function estadoNotificaciones() {
  const personas = getPersonas()
  return {
    activas: leerConfig('notif_activas') === '1',
    smtpConfigurado: smtpConfigurado(),
    destinatarios: destinatariosCorreo(),
    whatsapp: {
      activas: leerConfig('notif_whatsapp') !== '0',
      configurado: whatsappConfigurado(),
      plantilla: await estadoPlantilla(PLANTILLA_RECORDATORIO),
      personas: personas.map(p => ({ id: p.id, nombre: p.nombre, conWhatsApp: !!destinoWhatsApp(p) })),
    },
  }
}

export function activarNotificaciones(activas: boolean) { guardarConfig('notif_activas', activas ? '1' : '0') }
export function activarWhatsApp(activas: boolean) { guardarConfig('notif_whatsapp', activas ? '1' : '0') }

// ── Correo ───────────────────────────────────────────────────────────────────

interface Aviso { nombre: string; detalle: string }

function html(titulo: string, avisos: Aviso[]) {
  const filas = avisos.map(a => `<tr><td style="padding:10px 0;border-top:1px solid #dde3e1;font-weight:600">${esc(a.nombre)}</td>
    <td style="padding:10px 0;border-top:1px solid #dde3e1;text-align:right;color:#4b5652">${esc(a.detalle)}</td></tr>`).join('')
  return `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto;padding:24px;color:#111816">
    <p style="margin:0;color:#0f6b5c;font-size:12px;font-weight:700;letter-spacing:.06em">CUENTAS CLARAS</p>
    <h1 style="font-size:20px;margin:6px 0 16px">${esc(titulo)}</h1>
    <table style="width:100%;border-collapse:collapse;font-size:14px">${filas}</table>
    ${process.env.APP_URL ? `<p style="margin-top:20px"><a href="${process.env.APP_URL}/registrar" style="color:#0f6b5c;font-weight:700">Abrir la app</a></p>` : ''}
  </div>`
}
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

async function enviarCorreo(asunto: string, titulo: string, avisos: Aviso[]) {
  const to = destinatariosCorreo()
  if (!to.length) throw new Error('No hay correos en Ajustes → Hogar')
  await transporte().sendMail({
    from: `"Cuentas Claras" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to: to.join(', '), subject: asunto, html: html(titulo, avisos),
  })
}

export async function enviarPrueba() {
  if (!smtpConfigurado()) throw new Error('Falta configurar SMTP en el servidor (.env)')
  await enviarCorreo('Prueba de recordatorios', 'Los recordatorios funcionan', [
    { nombre: 'Ejemplo: Hipoteca', detalle: 'vence en 3 días' }, { nombre: 'Ejemplo: Luz', detalle: 'venció ayer' },
  ])
}

// ── Revisión diaria ──────────────────────────────────────────────────────────

type Tipo = '3dias' | 'hoy' | 'vencido'

const dinero = (n: number, moneda: string) =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: moneda, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

/** Gastos del mes sin pagar que vencen en 3 días, hoy, o vencieron ayer, con a quién le tocan. */
export function vencimientosDelDia(hoy = new Date()) {
  const anio = hoy.getFullYear(), mes = hoy.getMonth() + 1, dia = hoy.getDate()
  const estado = getEstadoMes(anio, mes)
  const items: { fila: FilaMes; tipo: Tipo; quien: PersonaId[]; monto: number | null }[] = []
  for (const f of estado.filas) {
    if (f.pago?.pagado || !f.diaVencimiento) continue
    const d = f.diaVencimiento
    const tipo: Tipo | null = d - dia === 3 ? '3dias' : d === dia ? 'hoy' : dia - d === 1 ? 'vencido' : null
    if (!tipo) continue
    const a = f.pago?.asignadoA ?? f.asignacionSugerida ?? f.concepto?.asignadoDefault ?? 'ambos'
    items.push({ fila: f, tipo, quien: a === 'ambos' ? ['1', '2'] : [a], monto: f.pago?.monto ?? f.montoSugerido })
  }
  return { anio, mes, dia, moneda: estado.config.monedaBase, items }
}

/** Envía los recordatorios de hoy. Idempotente: cada aviso sale una sola vez. Devuelve cuántos mensajes envió. */
export async function revisarVencimientos(hoy = new Date()): Promise<{ whatsapp: number; correo: number }> {
  const db = getDb()
  // Tabla propia: "notificaciones_enviadas" quedó de la versión 1 con otras columnas
  db.exec(`CREATE TABLE IF NOT EXISTS avisos_enviados (clave TEXT PRIMARY KEY, enviado_en TEXT NOT NULL DEFAULT (datetime('now')))`)
  const yaEnviado = db.prepare('SELECT 1 FROM avisos_enviados WHERE clave = ?')
  const marcar = db.prepare('INSERT OR IGNORE INTO avisos_enviados (clave) VALUES (?)')
  const { anio, mes, moneda, items } = vencimientosDelDia(hoy)
  const enviados = { whatsapp: 0, correo: 0 }
  const fecha = (d: number) => `${String(d).padStart(2, '0')}/${String(mes).padStart(2, '0')}`
  const detalle = (t: Tipo, d: number) => (t === 'hoy' ? 'vence hoy' : t === '3dias' ? `vence el ${fecha(d)}` : `venció el ${fecha(d)}`)
  const claveWa = (i: { tipo: Tipo; fila: FilaMes }, p: PersonaId) => `wa:${i.tipo}:${i.fila.concepto?.id ?? i.fila.key}:${anio}-${mes}:${p}`

  // WhatsApp: un mensaje por persona con lo suyo
  if (leerConfig('notif_whatsapp') !== '0' && whatsappConfigurado() && items.length
      && await estadoPlantilla(PLANTILLA_RECORDATORIO) === 'APPROVED') {
    for (const p of getPersonas()) {
      const para = destinoWhatsApp(p)
      if (!para) continue
      const suyos = items.filter(i => i.quien.includes(p.id) && !yaEnviado.get(claveWa(i, p.id)))
      if (!suyos.length) continue
      const orden: Record<Tipo, number> = { vencido: 0, hoy: 1, '3dias': 2 }
      suyos.sort((a, b) => orden[a.tipo] - orden[b.tipo])
      const lista = suyos.map(i => `${i.fila.nombre}${i.monto != null ? ` ${dinero(i.monto, moneda)}` : ''} ${detalle(i.tipo, i.fila.diaVencimiento!)}`).join(' · ')
      const total = suyos.reduce((s, i) => s + (i.monto ?? 0), 0)
      try {
        await enviarPlantilla(para, PLANTILLA_RECORDATORIO, [p.nombre.split(' ')[0], lista, dinero(total, moneda)])
        for (const i of suyos) marcar.run(claveWa(i, p.id))
        enviados.whatsapp++
      } catch (err) {
        console.error('[recordatorios] WhatsApp a', p.nombre, err)
      }
    }
  }

  // Correo: a la casa, como antes (3 días antes y el día siguiente)
  if (leerConfig('notif_activas') === '1' && smtpConfigurado()) {
    const nuevos = items.filter(i => i.tipo !== 'hoy' && !yaEnviado.get(`${i.tipo}:${i.fila.concepto?.id}:${anio}-${mes}`))
    const proximos = nuevos.filter(i => i.tipo === '3dias').map(i => ({ nombre: i.fila.nombre, detalle: `vence el ${i.fila.diaVencimiento}` }))
    const vencidos = nuevos.filter(i => i.tipo === 'vencido').map(i => ({ nombre: i.fila.nombre, detalle: `venció el ${i.fila.diaVencimiento}` }))
    if (proximos.length) { await enviarCorreo(`${proximos.length} pago(s) vencen en 3 días`, `Por vencer en ${MESES[mes - 1].toLowerCase()}`, proximos); enviados.correo++ }
    if (vencidos.length) { await enviarCorreo(`${vencidos.length} pago(s) vencieron ayer`, 'Pagos vencidos sin marcar', vencidos); enviados.correo++ }
    for (const i of nuevos) marcar.run(`${i.tipo}:${i.fila.concepto?.id}:${anio}-${mes}`)
  }
  return enviados
}

/** Prueba de WhatsApp: le envía la plantilla a una persona con un ejemplo. */
export async function enviarPruebaWhatsApp(personaId: PersonaId) {
  const p = getPersonas().find(x => x.id === personaId)
  const para = p && destinoWhatsApp(p)
  if (!p || !para) throw new Error('Esa persona no tiene WhatsApp registrado o vinculado')
  const estado = await estadoPlantilla(PLANTILLA_RECORDATORIO)
  if (estado !== 'APPROVED') throw new Error(`La plantilla de Meta todavía no está aprobada (estado: ${estado})`)
  await enviarPlantilla(para, PLANTILLA_RECORDATORIO, [p.nombre.split(' ')[0], 'Ejemplo: Luz Pluz S/ 183.00 vence hoy', 'S/ 183.00'])
}

/** Programador simple dentro del proceso: revisa cada 30 min y envía a partir de las 8:00 (zona del servidor, TZ). */
export function iniciarProgramador() {
  let ultimoDia = ''
  const tick = () => {
    const ahora = new Date()
    const hoy = `${ahora.getFullYear()}-${ahora.getMonth() + 1}-${ahora.getDate()}`
    if (ahora.getHours() < 8 || hoy === ultimoDia) return
    ultimoDia = hoy
    revisarVencimientos(ahora)
      .then(r => console.log(`[recordatorios] ${hoy}: ${r.whatsapp} WhatsApp, ${r.correo} correos`))
      .catch(err => console.error('[recordatorios]', err))
  }
  setInterval(tick, 30 * 60 * 1000).unref()
  tick()
  console.log('[recordatorios] programados: todos los días desde las 08:00')
}
