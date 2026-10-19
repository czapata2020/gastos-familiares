import type { Asignacion } from '@/types'

/** Qué quiso decir la persona en el chat. Puro: no toca la base, solo el texto. */
export type Intencion =
  | { tipo: 'ayuda' }
  | { tipo: 'resumen' }
  | { tipo: 'pendientes' }
  | { tipo: 'pagar'; texto: string }
  | { tipo: 'registrar'; texto: string; monto: number; quien: Asignacion | 'yo' | null; pagado: boolean }
  | { tipo: 'cancelar' }
  | { tipo: 'desconocido' }

export const normalizar = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

/**
 * Monto escrito como en Perú: "186", "186.50", "1,234.50", "320,5" (coma decimal), "S/ 85".
 * Si hay coma y punto, el último es el decimal. Si solo hay coma seguida de 1-2 dígitos, es decimal.
 */
export function leerMonto(token: string): number | null {
  const t = token.replace(/^s\/\.?/i, '').replace(/^(pen|usd|\$)/i, '')
  if (!/^\d[\d.,]*$/.test(t)) return null
  let n: string
  // Con coma y punto, el que va al final es el decimal: 1,234.50 (Perú) o 1.234,50 (Europa)
  if (t.includes(',') && t.includes('.')) n = t.lastIndexOf(',') > t.lastIndexOf('.') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '')
  else if (t.includes(',')) n = /,\d{1,2}$/.test(t) ? t.replace(/\.(?=\d{3})/g, '').replace(',', '.') : t.replace(/,/g, '')
  else n = t
  const v = Number(n)
  return Number.isFinite(v) && v > 0 && v < 1e9 ? Math.round(v * 100) / 100 : null
}

const PAGADO = new Set(['pagado', 'pagada', 'pague', 'ya', 'cancelado'])

/**
 * @param nombres nombres cortos normalizados de [persona1, persona2], para reconocer "luz 186 rudy".
 */
export function interpretar(textoOriginal: string, nombres: [string, string]): Intencion {
  const texto = normalizar(textoOriginal).replace(/[¿?¡!]/g, '').trim()
  if (!texto) return { tipo: 'desconocido' }

  if (/^(ayuda|help|hola|menu|inicio|comandos)$/.test(texto)) return { tipo: 'ayuda' }
  if (/^(cancelar|cancela|anular|no)$/.test(texto)) return { tipo: 'cancelar' }
  if (/^(resumen|total|como vamos|cuanto (llevamos|vamos|gastamos|va)( este mes)?)$/.test(texto)) return { tipo: 'resumen' }
  if (/^(pendientes?|que falta( pagar)?|por pagar|falta pagar)$/.test(texto)) return { tipo: 'pendientes' }

  const pago = /^(ya )?(pague|pagado|pagada|pagar|pago) (el |la |los |las )?(.+)$/.exec(texto)
  if (pago && !/\d/.test(pago[4])) return { tipo: 'pagar', texto: pago[4].trim() }

  // Registrar: el monto puede ir antes o después del nombre ("luz 180", "180 luz", "s/ 180 luz rudy pagado").
  // Las palabras de persona y "pagado" se reconocen en cualquier lugar; el resto es el nombre del gasto.
  const tokens = texto.split(' ').filter(t => t !== 's/' && t !== 's/.')
  const iMonto = tokens.findIndex(t => leerMonto(t) != null)
  if (iMonto >= 0 && tokens.length > 1) {
    const monto = leerMonto(tokens[iMonto])!
    let quien: Asignacion | 'yo' | null = null
    let pagado = false
    const palabras: string[] = []
    tokens.forEach((t, k) => {
      if (k === iMonto) return
      if (PAGADO.has(t)) pagado = true
      else if (t === 'ambos') quien = 'ambos'
      else if (t === 'yo' || t === 'mio' || t === 'mia') quien = 'yo'
      else if (nombres[0] && t === nombres[0]) quien = '1'
      else if (nombres[1] && t === nombres[1]) quien = '2'
      else palabras.push(t)
    })
    const concepto = palabras.join(' ')
    if (concepto) return { tipo: 'registrar', texto: concepto, monto, quien, pagado }
  }
  return { tipo: 'desconocido' }
}

/** Qué tan bien coincide lo escrito con un nombre de gasto (0 = nada). */
export function puntaje(escrito: string, nombre: string): number {
  const e = normalizar(escrito), n = normalizar(nombre)
  if (!e) return 0
  if (e === n) return 100
  if (n.startsWith(e)) return 80
  const palabrasN = n.split(' ')
  const palabrasE = e.split(' ')
  if (palabrasE.every(p => palabrasN.some(w => w.startsWith(p)))) return 60
  if (palabrasN.some(w => w.length >= 3 && e.includes(w))) return 40
  return 0
}

export function mejorCoincidencia<T extends { nombre: string }>(escrito: string, opciones: T[]): T | null {
  let mejor: T | null = null, top = 0
  for (const o of opciones) {
    const p = puntaje(escrito, o.nombre)
    if (p > top) { top = p; mejor = o }
  }
  return mejor
}
