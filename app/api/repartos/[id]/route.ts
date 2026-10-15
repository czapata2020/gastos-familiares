import { handler, ErrorValidacion } from '@/lib/api'
import { borrarReparto } from '@/lib/repo'

type Ctx = { params: Promise<{ id: string }> }

export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  try {
    borrarReparto((await params).id)
  } catch (e) {
    throw new ErrorValidacion((e as Error).message)
  }
})
