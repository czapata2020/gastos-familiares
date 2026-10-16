import { handler, v, ErrorValidacion } from '@/lib/api'
import { generarPlantilla } from '@/lib/plantilla'

export const dynamic = 'force-dynamic'

export const GET = handler(async (req: Request) => {
  const sp = new URL(req.url).searchParams
  const anio = v.entero(sp.get('anio') ?? new Date().getFullYear(), 2000, 2100, 'Año')
  const desde = v.entero(sp.get('desde') ?? 1, 1, 12, 'Mes inicial')
  const hasta = v.entero(sp.get('hasta') ?? 12, 1, 12, 'Mes final')
  if (hasta < desde) throw new ErrorValidacion('El mes final no puede ser anterior al inicial')
  const archivo = await generarPlantilla(anio, desde, hasta)
  return new Response(new Uint8Array(archivo), {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="gastos-${anio}-${String(desde).padStart(2, '0')}-a-${String(hasta).padStart(2, '0')}.xlsx"`,
    },
  })
})
