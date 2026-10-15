import { handler, ErrorValidacion } from '@/lib/api'
import { activarNotificaciones, enviarPrueba, estadoNotificaciones } from '@/lib/notificaciones'

export const dynamic = 'force-dynamic'

export const GET = handler(() => estadoNotificaciones())

export const PUT = handler(async (req: Request) => {
  activarNotificaciones((await req.json()).activas === true)
  return estadoNotificaciones()
})

export const POST = handler(async () => {
  try { await enviarPrueba() } catch (e) { throw new ErrorValidacion((e as Error).message) }
})
