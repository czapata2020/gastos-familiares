import { handler, periodoDe } from '@/lib/api'
import { headers } from 'next/headers'
import { getEstadoMes, personaPorEmail } from '@/lib/repo'

export const dynamic = 'force-dynamic'

export const GET = handler(async (req: Request) => {
  const { anio, mes } = periodoDe(req.url)
  return { ...getEstadoMes(anio, mes), yo: personaPorEmail((await headers()).get('x-user-email')) }
})
