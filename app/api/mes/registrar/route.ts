import { handler, v } from '@/lib/api'
import { registrarPendientes } from '@/lib/repo'

export const POST = handler(async (req: Request) => {
  const b = await req.json()
  const anio = v.entero(b.anio, 2000, 2100, 'Año')
  const mes = v.entero(b.mes, 1, 12, 'Mes')
  const creados = registrarPendientes(anio, mes, b.origen === 'mes-anterior' ? 'mes-anterior' : 'sugerido')
  return { ok: true, creados }
})
