'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

export async function api<T = unknown>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`)
  return data as T
}

/** Carga datos y permite recargarlos sin parpadeo (mantiene los anteriores mientras llega lo nuevo). */
export function useDatos<T>(url: string) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ultimo = useRef(url)
  const recargar = useCallback(async () => {
    ultimo.current = url
    try {
      const d = await api<T>(url)
      if (ultimo.current === url) { setData(d); setError(null) }
    } catch (e) {
      setError((e as Error).message)
    }
  }, [url])
  useEffect(() => { void recargar() }, [recargar])

  // Se vuelve a pedir al tocar "Actualizar" o al volver a la app (p. ej. después de registrar por WhatsApp)
  useEffect(() => {
    const alVolver = () => { if (document.visibilityState === 'visible') void recargar() }
    const alPedir = () => void recargar()
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener('pageshow', alPedir)
    window.addEventListener(EVENTO_RECARGAR, alPedir)
    return () => {
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener('pageshow', alPedir)
      window.removeEventListener(EVENTO_RECARGAR, alPedir)
    }
  }, [recargar])
  return { data, error, recargar, setData }
}

export const EVENTO_RECARGAR = 'cuentas-claras:recargar'
/** Pide a todas las pantallas abiertas que vuelvan a cargar sus datos. */
export function recargarTodo() { window.dispatchEvent(new Event(EVENTO_RECARGAR)) }

/** Mes seleccionado, compartido entre pantallas vía ?p=YYYY-MM. */
export function usePeriodo() {
  const sp = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const hoy = new Date()
  const m = /^(\d{4})-(\d{2})$/.exec(sp.get('p') ?? '')
  const anio = m ? Number(m[1]) : hoy.getFullYear()
  const mes = m ? Math.min(12, Math.max(1, Number(m[2]))) : hoy.getMonth() + 1
  const ir = useCallback((a: number, ms: number) => {
    const q = new URLSearchParams(sp.toString())
    q.set('p', `${a}-${String(ms).padStart(2, '0')}`)
    router.replace(`${pathname}?${q.toString()}`, { scroll: false })
  }, [sp, router, pathname])
  const mover = (delta: number) => {
    const t = anio * 12 + (mes - 1) + delta
    ir(Math.floor(t / 12), (t % 12) + 1)
  }
  return { anio, mes, ir, mover, query: sp.get('p') ? `?p=${sp.get('p')}` : '' }
}

export function dinero(n: number, moneda: string, decimales = 0) {
  try {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency', currency: moneda, minimumFractionDigits: decimales, maximumFractionDigits: decimales,
    }).format(n)
  } catch {
    return `${moneda} ${n.toFixed(decimales)}`
  }
}

export function pct(n: number, decimales = 0) {
  return `${n.toFixed(decimales)}%`
}

export function parseMonto(s: string): number | null {
  const t = s.trim().replace(/\s/g, '').replace(/,(?=\d{1,2}$)/, '.').replace(/,/g, '')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 ? n : null
}
