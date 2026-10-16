import { headers } from 'next/headers'
import { handler, v } from '@/lib/api'
import { getConfig, getPersonas, setConfig, setPersona } from '@/lib/repo'

export const dynamic = 'force-dynamic'

export const GET = handler(async () => ({
  config: getConfig(),
  personas: getPersonas(),
  usuario: (await headers()).get('x-user-email') ?? '',
}))

export const PUT = handler(async (req: Request) => {
  const b = await req.json()
  if (b.monedaBase !== undefined) setConfig({ monedaBase: v.moneda(b.monedaBase) })
  if (typeof b.asignacionAuto === 'boolean') setConfig({ asignacionAuto: b.asignacionAuto })
  for (const p of Array.isArray(b.personas) ? b.personas : []) {
    if (p.id !== '1' && p.id !== '2') continue
    setPersona({
      id: p.id, nombre: v.texto(p.nombre, 'Nombre', 40), email: v.texto(p.email, 'Correo', 120, false),
      telefono: v.texto(p.telefono, 'WhatsApp', 20, false),
    })
  }
})
