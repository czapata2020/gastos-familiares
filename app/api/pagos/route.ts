import { handler, v } from '@/lib/api'
import { crearPago } from '@/lib/repo'

export const POST = handler(async (req: Request) => {
  const b = await req.json()
  const id = crearPago({
    conceptoId: typeof b.conceptoId === 'string' ? b.conceptoId : null,
    nombre: v.texto(b.nombre, 'Nombre'),
    categoria: v.categoria(b.categoria),
    tipo: v.tipo(b.tipo),
    anio: v.entero(b.anio, 2000, 2100, 'Año'),
    mes: v.entero(b.mes, 1, 12, 'Mes'),
    monto: v.monto(b.monto),
    asignadoA: v.asignacion(b.asignadoA),
    pagado: b.pagado === true,
    nota: v.texto(b.nota, 'Nota', 200, false),
  })
  return { ok: true, id }
})
