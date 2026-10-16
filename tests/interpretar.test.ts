import { describe, expect, it } from 'vitest'
import { interpretar, leerMonto, mejorCoincidencia } from '@/lib/bot/interpretar'

const N: [string, string] = ['cesar', 'rudy']

describe('montos', () => {
  it('entiende los formatos habituales', () => {
    expect(leerMonto('186')).toBe(186)
    expect(leerMonto('186.50')).toBe(186.5)
    expect(leerMonto('320,5')).toBe(320.5)
    expect(leerMonto('1,234.50')).toBe(1234.5)
    expect(leerMonto('1,234')).toBe(1234)
    expect(leerMonto('1.234,50')).toBe(1234.5)
    expect(leerMonto('138,10')).toBe(138.1)
    expect(leerMonto('138.10')).toBe(138.1)
    expect(leerMonto('s/85')).toBe(85)
    expect(leerMonto('luz')).toBeNull()
    expect(leerMonto('0')).toBeNull()
  })
})

describe('intenciones', () => {
  it('registrar con persona, yo, ambos y pagado', () => {
    expect(interpretar('luz 186', N)).toEqual({ tipo: 'registrar', texto: 'luz', monto: 186, quien: null, pagado: false })
    expect(interpretar('Súper Wong 320,50 Rudy pagado', N)).toEqual({ tipo: 'registrar', texto: 'super wong', monto: 320.5, quien: '2', pagado: true })
    expect(interpretar('farmacia S/ 85 yo', N)).toMatchObject({ texto: 'farmacia', monto: 85, quien: 'yo' })
    expect(interpretar('regalo 200 ambos', N)).toMatchObject({ quien: 'ambos' })
  })
  it('consultas y pagos', () => {
    expect(interpretar('¿Cuánto llevamos?', N)).toEqual({ tipo: 'resumen' })
    expect(interpretar('qué falta', N)).toEqual({ tipo: 'pendientes' })
    expect(interpretar('Pagué la hipoteca', N)).toEqual({ tipo: 'pagar', texto: 'hipoteca' })
    expect(interpretar('ayuda', N)).toEqual({ tipo: 'ayuda' })
    expect(interpretar('hola que tal', N)).toEqual({ tipo: 'desconocido' })
    expect(interpretar('186', N)).toEqual({ tipo: 'desconocido' })
  })
  it('encuentra el gasto aunque se escriba corto o sin tildes', () => {
    const op = [{ nombre: 'Luz del Sur' }, { nombre: 'Hipoteca BCP' }, { nombre: 'Seguro vehicular' }]
    expect(mejorCoincidencia('luz', op)?.nombre).toBe('Luz del Sur')
    expect(mejorCoincidencia('hipoteca', op)?.nombre).toBe('Hipoteca BCP')
    expect(mejorCoincidencia('seguro auto', op)?.nombre).toBe('Seguro vehicular')
    expect(mejorCoincidencia('pasajes', op)).toBeNull()
  })
})
