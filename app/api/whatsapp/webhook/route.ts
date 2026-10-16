import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { procesarMensaje } from '@/lib/bot/bot'
import { guardarWaUserId, personaPorRemitente, usarCodigoVinculo } from '@/lib/repo'
import { enviar, firmaValida } from '@/lib/whatsapp'

/**
 * Webhook de WhatsApp. Es la única ruta sin Cloudflare Access (Meta no puede iniciar sesión):
 * cada POST se valida con la firma HMAC del App Secret y solo responde a los teléfonos de Ajustes.
 */
export const dynamic = 'force-dynamic'

// Meta verifica la URL una vez al registrarla
export function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const token = process.env.WHATSAPP_VERIFY_TOKEN
  if (token && sp.get('hub.mode') === 'subscribe' && sp.get('hub.verify_token') === token) {
    return new Response(sp.get('hub.challenge') ?? '', { status: 200 })
  }
  return new Response('Forbidden', { status: 403 })
}

interface MensajeWA {
  id: string
  from?: string
  from_user_id?: string
  type: string
  text?: { body: string }
  interactive?: { button_reply?: { id: string } }
}

interface ContactoWA { wa_id?: string; user_id?: string; profile?: { name?: string } }

export async function POST(req: Request) {
  const cuerpo = await req.text()
  if (!firmaValida(cuerpo, req.headers.get('x-hub-signature-256'))) return new Response('Forbidden', { status: 403 })

  let datos: { entry?: { changes?: { value?: { messages?: MensajeWA[]; contacts?: ContactoWA[] } }[] }[] }
  try { datos = JSON.parse(cuerpo) } catch { return new Response('Bad Request', { status: 400 }) }

  const valores = (datos.entry ?? []).flatMap(e => e.changes ?? []).map(c => c.value ?? {})
  const marcar = getDb().prepare('INSERT OR IGNORE INTO wa_mensajes (id) VALUES (?)')

  for (const v of valores) for (const m of v.messages ?? []) {
    // Meta reintenta si no respondemos rápido: cada mensaje se procesa una sola vez
    if (marcar.run(m.id).changes === 0) continue
    // Quién escribe: número de teléfono si Meta lo manda; si no, su ID de WhatsApp (BSUID)
    const userId = m.from_user_id ?? v.contacts?.find(c => c.user_id)?.user_id ?? ''
    const telefono = m.from ?? v.contacts?.find(c => c.wa_id)?.wa_id ?? ''
    const remitente = telefono || userId
    if (!remitente) { console.warn('[whatsapp] mensaje sin número ni ID de usuario'); continue }

    let persona = personaPorRemitente(telefono) ?? personaPorRemitente(userId)
    // Si llegó con número y con ID, guardamos el ID: así la reconocemos aunque Meta deje de mandar el número
    if (persona && telefono && userId && persona.waUserId !== userId) guardarWaUserId(persona.id, userId)

    if (!persona) {
      // Única excepción para desconocidos: "vincular 123456" con un código generado en Ajustes → Hogar
      const codigo = /^\s*vincular\s+(\d{6})\s*$/i.exec(m.text?.body ?? '')?.[1]
      persona = codigo ? usarCodigoVinculo(codigo, userId || remitente) : null
      if (!persona) { console.warn(`[whatsapp] remitente no autorizado (${userId ? 'ID' : 'número'} …${remitente.slice(-2)})`); continue }
      try {
        await enviar(remitente, { texto: `✓ Listo ${persona.nombre.split(' ')[0]}, tu WhatsApp quedó vinculado. Escribe *ayuda* para ver qué puedo hacer.` })
      } catch (err) { console.error('[whatsapp]', err) }
      continue
    }
    m.from = remitente
    try {
      const boton = m.interactive?.button_reply?.id
      const texto = m.text?.body ?? ''
      if (!boton && !texto) {
        await enviar(m.from, { texto: 'Por ahora solo entiendo texto. Escribe *ayuda* para ver ejemplos.' })
        continue
      }
      for (const r of procesarMensaje(m.from, texto, boton)) await enviar(m.from, r)
    } catch (err) {
      console.error('[whatsapp]', err)
    }
  }
  // Siempre 200 para mensajes firmados: si devolvemos error, Meta reintenta en bucle
  return NextResponse.json({ ok: true })
}
