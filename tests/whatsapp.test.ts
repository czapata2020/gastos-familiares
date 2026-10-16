import { describe, expect, it } from 'vitest'
import { createHmac } from 'node:crypto'

process.env.WHATSAPP_APP_SECRET = 'secreto-de-prueba'
const { firmaValida } = await import('@/lib/whatsapp')
const firmar = (cuerpo: string, secreto = 'secreto-de-prueba') => 'sha256=' + createHmac('sha256', secreto).update(cuerpo).digest('hex')

describe('firma del webhook', () => {
  const cuerpo = '{"entry":[{"changes":[]}]}'
  it('acepta solo lo firmado con el App Secret', () => {
    expect(firmaValida(cuerpo, firmar(cuerpo))).toBe(true)
    expect(firmaValida(cuerpo, firmar(cuerpo, 'otro'))).toBe(false)
    expect(firmaValida(cuerpo + ' ', firmar(cuerpo))).toBe(false)
    expect(firmaValida(cuerpo, null)).toBe(false)
    expect(firmaValida(cuerpo, 'sha256=corta')).toBe(false)
  })
})
