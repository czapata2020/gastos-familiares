import { handler, v } from '@/lib/api'
import { actualizarPago, borrarPago } from '@/lib/repo'

type Ctx = { params: Promise<{ id: string }> }

export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const { id } = await params
  const b = await req.json()
  actualizarPago(id, {
    ...(b.monto !== undefined && { monto: v.monto(b.monto) }),
    ...(b.asignadoA !== undefined && { asignadoA: v.asignacion(b.asignadoA) }),
    ...(b.pagado !== undefined && { pagado: b.pagado === true }),
    ...(b.nota !== undefined && { nota: v.texto(b.nota, 'Nota', 200, false) }),
    ...(b.nombre !== undefined && { nombre: v.texto(b.nombre, 'Nombre') }),
  })
})

export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  borrarPago((await params).id)
})
