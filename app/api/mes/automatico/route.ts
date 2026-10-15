import { handler, v } from '@/lib/api'
import { automatizarMes } from '@/lib/repo'

export const POST = handler(async (req: Request) => {
  const b = await req.json()
  const cambiados = automatizarMes(v.entero(b.anio, 2000, 2100, 'Año'), v.entero(b.mes, 1, 12, 'Mes'))
  return { ok: true, cambiados }
})
