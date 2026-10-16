import { handler, ErrorValidacion } from '@/lib/api'
import { crearCodigoVinculo } from '@/lib/repo'

/** Genera un código de un solo uso (15 min) para vincular el WhatsApp de una persona. Requiere sesión (Cloudflare Access). */
export const POST = handler(async (req: Request) => {
  const { personaId } = await req.json()
  if (personaId !== '1' && personaId !== '2') throw new ErrorValidacion('Persona inválida')
  return { codigo: crearCodigoVinculo(personaId), minutos: 15 }
})
