import nodemailer from 'nodemailer'
import type { Concepto, Pago } from '@/types'
import { getDb } from './db'
import { armarFilas, MESES } from './reparto'

/**
 * Recordatorios por correo: 3 días antes del vencimiento y el día siguiente si sigue sin pagar.
 * Apagados por defecto; se activan en Ajustes. SMTP por variables de entorno (SMTP_HOST, SMTP_PORT,
 * SMTP_USER, SMTP_PASS, SMTP_FROM). En la fase de WhatsApp este módulo enviará por ese canal también.
 */

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

function destinatarios(): string[] {
  return (getDb().prepare("SELECT email FROM personas WHERE email LIKE '%@%'").all() as { email: string }[]).map(r => r.email)
}

export function estadoNotificaciones() {
  return { activas: leerConfig('notif_activas') === '1', smtpConfigurado: smtpConfigurado(), destinatarios: destinatarios() }
}

export function activarNotificaciones(activas: boolean) {
  getDb().prepare("INSERT OR REPLACE INTO config (clave, valor) VALUES ('notif_activas', ?)").run(activas ? '1' : '0')
}

interface Aviso { nombre: string; detalle: string }

function html(titulo: string, avisos: Aviso[]) {
  const filas = avisos.map(a => `<tr><td style="padding:10px 0;border-top:1px solid #dde3e1;font-weight:600">${esc(a.nombre)}</td>
    <td style="padding:10px 0;border-top:1px solid #dde3e1;text-align:right;color:#4b5652">${esc(a.detalle)}</td></tr>`).join('')
  return `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto;padding:24px;color:#111816">
    <p style="margin:0;color:#0f6b5c;font-size:12px;font-weight:700;letter-spacing:.06em">GASTOS FAMILIARES</p>
    <h1 style="font-size:20px;margin:6px 0 16px">${esc(titulo)}</h1>
    <table style="width:100%;border-collapse:collapse;font-size:14px">${filas}</table>
    ${process.env.APP_URL ? `<p style="margin-top:20px"><a href="${process.env.APP_URL}/registrar" style="color:#0f6b5c;font-weight:700">Abrir la app</a></p>` : ''}
  </div>`
}
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

async function enviar(asunto: string, titulo: string, avisos: Aviso[]) {
  const to = destinatarios()
  if (!to.length) throw new Error('No hay correos en Ajustes → Hogar')
  await transporte().sendMail({
    from: `"Gastos Familiares" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to: to.join(', '), subject: asunto, html: html(titulo, avisos),
  })
}

export async function enviarPrueba() {
  if (!smtpConfigurado()) throw new Error('Falta configurar SMTP en el servidor (.env)')
  await enviar('Prueba de recordatorios', 'Los recordatorios funcionan', [
    { nombre: 'Ejemplo: Hipoteca', detalle: 'vence en 3 días' }, { nombre: 'Ejemplo: Luz', detalle: 'venció ayer' },
  ])
}

/** Revisa vencimientos de hoy. Idempotente: cada aviso se envía una sola vez. */
export async function revisarVencimientos(hoy = new Date()) {
  if (leerConfig('notif_activas') !== '1' || !smtpConfigurado()) return
  const db = getDb()
  const anio = hoy.getFullYear(), mes = hoy.getMonth() + 1, dia = hoy.getDate()
  db.exec(`CREATE TABLE IF NOT EXISTS notificaciones_enviadas (clave TEXT PRIMARY KEY, enviado_en TEXT NOT NULL DEFAULT (datetime('now')))`)

  const conceptos = (db.prepare("SELECT * FROM conceptos WHERE activo = 1 AND dia_vencimiento IS NOT NULL").all() as Record<string, any>[])
    .map(r => ({
      id: r.id, nombre: r.nombre, categoria: r.categoria, tipo: r.tipo, montoRef: r.monto_ref, asignadoDefault: r.asignado_default,
      diaVencimiento: r.dia_vencimiento, mesesActivos: JSON.parse(r.meses_activos), mesesCuotaDoble: JSON.parse(r.meses_cuota_doble),
      nota: r.nota, activo: true,
    }) as Concepto)
  const pagos = (db.prepare('SELECT * FROM pagos WHERE anio = ? AND mes = ?').all(anio, mes) as Record<string, any>[])
    .map(r => ({ id: r.id, conceptoId: r.concepto_id, pagado: r.pagado === 1 }) as Pago)

  const proximos: Aviso[] = [], vencidos: Aviso[] = []
  const yaEnviado = db.prepare('SELECT 1 FROM notificaciones_enviadas WHERE clave = ?')
  const marcar = db.prepare('INSERT OR IGNORE INTO notificaciones_enviadas (clave) VALUES (?)')
  const claves: string[] = []

  for (const f of armarFilas(conceptos, pagos, mes)) {
    if (!f.concepto || f.pago?.pagado || !f.diaVencimiento) continue
    const tipo = f.diaVencimiento - dia === 3 ? '3dias' : dia - f.diaVencimiento === 1 ? 'vencido' : null
    if (!tipo) continue
    const clave = `${tipo}:${f.concepto.id}:${anio}-${mes}`
    if (yaEnviado.get(clave)) continue
    claves.push(clave)
    ;(tipo === '3dias' ? proximos : vencidos).push({ nombre: f.nombre, detalle: tipo === '3dias' ? `vence el ${f.diaVencimiento}` : `venció el ${f.diaVencimiento}` })
  }
  if (proximos.length) await enviar(`${proximos.length} pago(s) vencen en 3 días`, `Por vencer en ${MESES[mes - 1].toLowerCase()}`, proximos)
  if (vencidos.length) await enviar(`${vencidos.length} pago(s) vencieron ayer`, 'Pagos vencidos sin marcar', vencidos)
  for (const c of claves) marcar.run(c)
}

/** Programador simple dentro del proceso: revisa cada 30 min y envía a partir de las 8:00 (zona del servidor, TZ). */
export function iniciarProgramador() {
  let ultimoDia = ''
  const tick = () => {
    const ahora = new Date()
    const hoy = `${ahora.getFullYear()}-${ahora.getMonth() + 1}-${ahora.getDate()}`
    if (ahora.getHours() < 8 || hoy === ultimoDia) return
    ultimoDia = hoy
    revisarVencimientos(ahora).catch(err => console.error('[notificaciones]', err))
  }
  setInterval(tick, 30 * 60 * 1000).unref()
  tick()
}
