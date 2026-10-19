import { handler, ErrorValidacion } from '@/lib/api'
import { activarNotificaciones, activarWhatsApp, enviarPrueba, enviarPruebaWhatsApp, estadoNotificaciones } from '@/lib/notificaciones'

export const dynamic = 'force-dynamic'

export const GET = handler(() => estadoNotificaciones())

/** { activas?: boolean (correo), whatsapp?: boolean } */
export const PUT = handler(async (req: Request) => {
  const b = await req.json()
  if (typeof b.activas === 'boolean') activarNotificaciones(b.activas)
  if (typeof b.whatsapp === 'boolean') activarWhatsApp(b.whatsapp)
  return estadoNotificaciones()
})

/** Prueba: { canal: 'whatsapp', personaId } o, sin cuerpo, correo. */
export const POST = handler(async (req: Request) => {
  const b = await req.json().catch(() => ({}))
  try {
    if (b.canal === 'whatsapp') await enviarPruebaWhatsApp(b.personaId === '2' ? '2' : '1')
    else await enviarPrueba()
  } catch (e) { throw new ErrorValidacion((e as Error).message) }
})
