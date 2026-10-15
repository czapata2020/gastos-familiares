import { handler, leerConcepto } from '@/lib/api'
import { borrarConcepto, guardarConcepto } from '@/lib/repo'

type Ctx = { params: Promise<{ id: string }> }

export const PUT = handler(async (req: Request, { params }: Ctx) => {
  const { id } = await params
  guardarConcepto({ ...leerConcepto(await req.json()), id })
})

export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  borrarConcepto((await params).id)
})
