import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Cliente mínimo de la WhatsApp Cloud API (Meta).
 *   WHATSAPP_TOKEN            token permanente del usuario del sistema
 *   WHATSAPP_PHONE_NUMBER_ID  identificador del número del bot (no el número en sí)
 *   WHATSAPP_APP_SECRET       clave secreta de la app: valida que el webhook viene de Meta
 *   WHATSAPP_VERIFY_TOKEN     texto que elegimos nosotros para registrar el webhook
 */
const VERSION = process.env.WHATSAPP_API_VERSION ?? 'v25.0'

export interface Boton { id: string; titulo: string }
export interface Respuesta { texto: string; botones?: Boton[] }

export const whatsappConfigurado = () =>
  !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_APP_SECRET)

/** Compara la firma X-Hub-Signature-256 contra el cuerpo crudo. */
export function firmaValida(cuerpo: string, cabecera: string | null): boolean {
  const secreto = process.env.WHATSAPP_APP_SECRET
  if (!secreto || !cabecera?.startsWith('sha256=')) return false
  const esperada = Buffer.from(createHmac('sha256', secreto).update(cuerpo, 'utf8').digest('hex'))
  const recibida = Buffer.from(cabecera.slice(7))
  return esperada.length === recibida.length && timingSafeEqual(esperada, recibida)
}

export async function enviar(para: string, r: Respuesta): Promise<void> {
  const cuerpo = r.botones?.length
    ? {
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: r.texto.slice(0, 1024) },
          // WhatsApp admite hasta 3 botones de respuesta, con títulos de hasta 20 caracteres
          action: { buttons: r.botones.slice(0, 3).map(b => ({ type: 'reply', reply: { id: b.id, title: b.titulo.slice(0, 20) } })) },
        },
      }
    : { type: 'text', text: { body: r.texto.slice(0, 4096), preview_url: false } }

  const res = await fetch(`https://graph.facebook.com/${VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: para, ...cuerpo }),
  })
  if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${(await res.text()).slice(0, 300)}`)
}
