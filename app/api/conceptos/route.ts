import { handler, leerConcepto } from '@/lib/api'
import { guardarConcepto, listConceptos } from '@/lib/repo'

export const dynamic = 'force-dynamic'

export const GET = handler(() => listConceptos(true))

export const POST = handler(async (req: Request) => ({ ok: true, id: guardarConcepto(leerConcepto(await req.json())) }))
