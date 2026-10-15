import { handler, periodoDe } from '@/lib/api'
import { aniosConDatos, getMetricas } from '@/lib/repo'

export const dynamic = 'force-dynamic'

export const GET = handler((req: Request) => {
  const { anio, mes } = periodoDe(req.url)
  return { ...getMetricas(anio, mes), anios: aniosConDatos() }
})
