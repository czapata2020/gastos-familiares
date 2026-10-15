import { handler, v, ErrorValidacion } from '@/lib/api'
import { guardarReparto, listRepartos } from '@/lib/repo'

export const dynamic = 'force-dynamic'

export const GET = handler(() => listRepartos())

export const POST = handler(async (req: Request) => {
  const b = await req.json()
  const manual = b.porcentajeManual === null || b.porcentajeManual === '' || b.porcentajeManual === undefined
    ? null : v.monto(b.porcentajeManual, 'Porcentaje')
  if (manual != null && manual > 100) throw new ErrorValidacion('El porcentaje no puede pasar de 100')
  const id = guardarReparto({
    id: typeof b.id === 'string' ? b.id : undefined,
    desde: v.periodo(b.desde),
    salario1: v.monto(b.salario1, 'Salario'),
    moneda1: v.moneda(b.moneda1),
    salario2: v.monto(b.salario2, 'Salario'),
    moneda2: v.moneda(b.moneda2),
    tipoCambio: v.monto(b.tipoCambio, 'Tipo de cambio') || 1,
    porcentajeManual: manual,
  })
  return { ok: true, id }
})
