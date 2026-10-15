import 'server-only'
import { NextResponse } from 'next/server'
import type { Asignacion, Categoria, TipoConcepto } from '@/types'
import { CATEGORIAS } from './categorias'

export class ErrorValidacion extends Error {}

/** Envuelve un handler: errores de validación → 400, el resto → 500 con log. */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<unknown> | unknown) {
  return async (...args: A) => {
    try {
      const out = await fn(...args)
      return out instanceof Response ? out : NextResponse.json(out ?? { ok: true })
    } catch (err) {
      if (err instanceof ErrorValidacion) return NextResponse.json({ error: err.message }, { status: 400 })
      console.error(err)
      return NextResponse.json({ error: 'Error interno, intenta de nuevo.' }, { status: 500 })
    }
  }
}

const falla = (msg: string): never => { throw new ErrorValidacion(msg) }

export const v = {
  entero(x: unknown, min: number, max: number, campo: string): number {
    const n = Number(x)
    return Number.isInteger(n) && n >= min && n <= max ? n : falla(`${campo} inválido`)
  },
  monto(x: unknown, campo = 'Monto'): number {
    const n = typeof x === 'string' ? Number(x.replace(',', '.')) : Number(x)
    return Number.isFinite(n) && n >= 0 && n < 1e10 ? Math.round(n * 100) / 100 : falla(`${campo} inválido`)
  },
  montoOpcional(x: unknown, campo = 'Monto'): number | null {
    return x === null || x === undefined || x === '' ? null : v.monto(x, campo)
  },
  texto(x: unknown, campo: string, max = 120, requerido = true): string {
    const s = typeof x === 'string' ? x.trim() : ''
    if (requerido && !s) falla(`${campo} es obligatorio`)
    return s.slice(0, max)
  },
  asignacion(x: unknown): Asignacion {
    return x === '1' || x === '2' || x === 'ambos' ? x : falla('Asignación inválida')
  },
  tipo(x: unknown): TipoConcepto {
    return x === 'fijo' || x === 'variable' || x === 'ocasional' ? x : falla('Tipo inválido')
  },
  categoria(x: unknown): Categoria {
    return CATEGORIAS.some(c => c.id === x) ? (x as Categoria) : 'otro'
  },
  meses(x: unknown): number[] {
    if (!Array.isArray(x)) return []
    return [...new Set(x.map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= 12))].sort((a, b) => a - b)
  },
  periodoOpcional(x: unknown, campo: string): string | null {
    if (x === null || x === undefined || x === '') return null
    return typeof x === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(x) ? x : falla(`${campo} inválido (YYYY-MM)`)
  },
  periodo(x: unknown): string {
    return typeof x === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(x) ? x : falla('Mes de inicio inválido (YYYY-MM)')
  },
  moneda(x: unknown): string {
    return typeof x === 'string' && /^[A-Z]{3}$/.test(x) ? x : falla('Moneda inválida')
  },
}

export function periodoDe(url: string) {
  const sp = new URL(url).searchParams
  const hoy = new Date()
  return {
    anio: v.entero(sp.get('anio') ?? hoy.getFullYear(), 2000, 2100, 'Año'),
    mes: v.entero(sp.get('mes') ?? hoy.getMonth() + 1, 1, 12, 'Mes'),
  }
}

export function leerConcepto(b: Record<string, unknown>) {
  const dia = b.diaVencimiento === null || b.diaVencimiento === '' || b.diaVencimiento === undefined
    ? null : v.entero(b.diaVencimiento, 1, 31, 'Día de vencimiento')
  return {
    nombre: v.texto(b.nombre, 'Nombre'),
    categoria: v.categoria(b.categoria),
    tipo: v.tipo(b.tipo),
    montoRef: v.montoOpcional(b.montoRef, 'Monto de referencia'),
    asignadoDefault: v.asignacion(b.asignadoDefault ?? 'ambos'),
    diaVencimiento: dia,
    mesesActivos: v.meses(b.mesesActivos),
    mesesCuotaDoble: v.meses(b.mesesCuotaDoble),
    nota: v.texto(b.nota, 'Nota', 200, false),
    activo: b.activo !== false,
    ...rangoMeses(b),
  }
}

function rangoMeses(b: Record<string, unknown>) {
  const desde = v.periodoOpcional(b.desde, 'Mes de inicio')
  const hasta = v.periodoOpcional(b.hasta, 'Último mes')
  if (desde && hasta && hasta < desde) throw new ErrorValidacion('El último mes no puede ser anterior al de inicio')
  return { desde, hasta }
}
