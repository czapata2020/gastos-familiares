import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { procesarMensaje } from '@/lib/bot/bot'
import { personaPorTelefono } from '@/lib/repo'
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
  from: string
  type: string
  text?: { body: string }
  interactive?: { button_reply?: { id: string } }
}

export async function POST(req: Request) {
  const cuerpo = await req.text()
  if (!firmaValida(cuerpo, req.headers.get('x-hub-signature-256'))) return new Response('Forbidden', { status: 403 })

  let datos: { entry?: { changes?: { value?: { messages?: MensajeWA[] } }[] }[] }
  try { datos = JSON.parse(cuerpo) } catch { return new Response('Bad Request', { status: 400 }) }

  const mensajes = (datos.entry ?? []).flatMap(e => e.changes ?? []).flatMap(c => c.value?.messages ?? [])
  const marcar = getDb().prepare('INSERT OR IGNORE INTO wa_mensajes (id) VALUES (?)')

  for (const m of mensajes) {
    // Meta reintenta si no respondemos rápido: cada mensaje se procesa una sola vez
    if (marcar.run(m.id).changes === 0) continue
    // Solo los teléfonos registrados en Ajustes → Hogar pueden usar el bot; al resto no se le responde
    if (!personaPorTelefono(m.from)) { console.warn('[whatsapp] número no autorizado'); continue }
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
