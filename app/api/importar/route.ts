import { handler, ErrorValidacion } from '@/lib/api'
import { aplicarImportacion, planificarImportacion } from '@/lib/plantilla'

export const dynamic = 'force-dynamic'
const MAX_BYTES = 5 * 1024 * 1024

/**
 * multipart: archivo (.xlsx) + modo = "previsualizar" | "aplicar" + reemplazar = "1" (borrón y cuenta nueva
 * en los meses del archivo). Previsualizar no escribe nada.
 */
export const POST = handler(async (req: Request) => {
  const form = await req.formData()
  const archivo = form.get('archivo')
  if (!(archivo instanceof File) || archivo.size === 0) throw new ErrorValidacion('Elige el archivo de la plantilla')
  if (archivo.size > MAX_BYTES) throw new ErrorValidacion('El archivo pesa más de 5 MB')
  let plan
  const reemplazar = form.get('reemplazar') === '1'
  try { plan = await planificarImportacion(await archivo.arrayBuffer(), reemplazar) } catch (e) { throw new ErrorValidacion((e as Error).message) }
  if (form.get('modo') !== 'aplicar') return plan
  if (plan.errores.length) throw new ErrorValidacion('La plantilla tiene errores: corrígelos y vuelve a subirla')
  return { ok: true, ...aplicarImportacion(plan) }
})
