'use client'

import { useEffect, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Copy, RefreshCw, X } from 'lucide-react'
import { recargarTodo } from '@/lib/cliente'
import type { Asignacion, Persona, PersonaId } from '@/types'
import type { EstadoVencimiento } from '@/lib/reparto'
import { MESES } from '@/lib/reparto'
import { CATEGORIAS } from '@/lib/categorias'
import { Logo } from './Logo'

export const inputCls =
  'w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25'
export const btnPrimario =
  'inline-flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-accent-ink transition hover:opacity-90 disabled:opacity-40'
export const btnSecundario =
  'inline-flex items-center justify-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink transition hover:bg-surface-2 disabled:opacity-40'

export function Encabezado({ titulo, children }: { titulo: string; children?: React.ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <h1 className="flex items-center gap-2.5 font-display text-[26px] font-bold leading-tight md:text-3xl">
          <span className="md:hidden"><Logo size={30} /></span>{titulo}
        </h1>
        <BotonActualizar />
      </div>
      {children}
    </header>
  )
}

export function MesSelector({ anio, mes, mover }: { anio: number; mes: number; mover: (d: number) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-surface p-1 shadow-sm ring-1 ring-line">
      <button type="button" onClick={() => mover(-1)} aria-label="Mes anterior"
        className="grid h-9 w-9 place-items-center rounded-full text-ink-2 hover:bg-surface-2"><ChevronLeft className="h-5 w-5" /></button>
      <span className="min-w-[128px] text-center font-display text-[15px] font-bold">{MESES[mes - 1]} {anio}</span>
      <button type="button" onClick={() => mover(1)} aria-label="Mes siguiente"
        className="grid h-9 w-9 place-items-center rounded-full text-ink-2 hover:bg-surface-2"><ChevronRight className="h-5 w-5" /></button>
    </div>
  )
}

export function Tarjeta({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <section className={`rounded-xl2 bg-surface p-4 ring-1 ring-line/60 ${className}`}>{children}</section>
}

export function Seccion({ titulo, extra, children }: { titulo: string; extra?: React.ReactNode; children: React.ReactNode }) {
  // extra puede ser texto (gris) o un control
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 px-1">
        <h2 className="font-display text-base font-bold">{titulo}</h2>
        {extra && <span className="min-w-0 text-xs text-ink-3">{extra}</span>}
      </div>
      {children}
    </div>
  )
}

const ESTADOS: Record<EstadoVencimiento, { txt: string; cls: string }> = {
  pagado: { txt: 'Pagado', cls: 'text-good bg-good/10' },
  vencido: { txt: 'Vencido', cls: 'text-bad bg-bad/10' },
  'por-vencer': { txt: 'Por vencer', cls: 'text-warn bg-warn/10' },
  pendiente: { txt: 'Pendiente', cls: 'text-ink-2 bg-surface-2' },
  'sin-registrar': { txt: 'Sin registrar', cls: 'text-ink-3 bg-surface-2' },
}
export function PillEstado({ estado, dia }: { estado: EstadoVencimiento; dia?: number | null }) {
  const e = ESTADOS[estado]
  const sufijo = dia && estado !== 'pagado' ? ` · día ${dia}` : ''
  return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${e.cls}`}>{e.txt}{sufijo}</span>
}

export function nombreCorto(p: Persona) {
  return p.nombre.split(' ')[0] || `Persona ${p.id}`
}

export function Chips({ valor, personas, onChange, disabled }: {
  valor: Asignacion; personas: [Persona, Persona]; onChange: (a: Asignacion) => void; disabled?: boolean
}) {
  const ops: [Asignacion, string][] = [['1', nombreCorto(personas[0])], ['ambos', 'Ambos'], ['2', nombreCorto(personas[1])]]
  return (
    <div role="radiogroup" aria-label="Quién paga" className="inline-flex rounded-full bg-surface-2 p-0.5">
      {ops.map(([k, txt]) => {
        const on = valor === k
        const color = k === '1' ? 'bg-p1' : k === '2' ? 'bg-p2' : 'bg-ink'
        return (
          <button key={k} type="button" role="radio" aria-checked={on} disabled={disabled} onClick={() => onChange(k)}
            className={`rounded-full px-2.5 py-1 text-[12px] font-semibold transition ${on ? `${color} text-white shadow-sm dark:text-bg` : 'text-ink-2'}`}>
            {txt}
          </button>
        )
      })}
    </div>
  )
}

export function Avatar({ persona, size = 28 }: { persona: Persona; size?: number }) {
  return (
    <span className={`inline-grid place-items-center rounded-full font-bold text-white ${persona.id === '1' ? 'bg-p1' : 'bg-p2'}`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {(persona.nombre || '?')[0].toUpperCase()}
    </span>
  )
}

export function BarraReparto({ a, b, alto = 10 }: { a: number; b: number; alto?: number }) {
  const t = a + b || 1
  return (
    <div className="flex gap-0.5 overflow-hidden rounded-md" style={{ height: alto }}>
      <i className="block bg-p1" style={{ width: `${(a / t) * 100}%` }} />
      <i className="block flex-1 bg-p2" />
    </div>
  )
}

/** Hoja inferior en celular, diálogo centrado en escritorio. */
export function Hoja({ abierta, onCerrar, titulo, children }: {
  abierta: boolean; onCerrar: () => void; titulo: string; children: React.ReactNode
}) {
  useEffect(() => {
    if (!abierta) return
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', esc)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', esc); document.body.style.overflow = '' }
  }, [abierta, onCerrar])
  if (!abierta) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={onCerrar}>
      <div role="dialog" aria-modal="true" aria-label={titulo} onClick={e => e.stopPropagation()}
        className="max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl bg-surface p-5 md:max-w-lg md:rounded-3xl"
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">{titulo}</h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface-2">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function useAviso() {
  const [msg, setMsg] = useState<{ txt: string; error?: boolean } | null>(null)
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 2800)
    return () => clearTimeout(t)
  }, [msg])
  const nodo = msg && (
    <div role="status" className="fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 md:bottom-8">
      <span className={`rounded-full px-4 py-2.5 text-sm font-semibold shadow-lg ${msg.error ? 'bg-bad text-white' : 'bg-ink text-bg'}`}>{msg.txt}</span>
    </div>
  )
  return { aviso: (txt: string, error = false) => setMsg({ txt, error }), nodo }
}

export function Cargando() {
  return (
    <div className="grid gap-3" aria-busy="true" aria-label="Cargando">
      {[0, 1, 2].map(i => <div key={i} className="h-24 animate-pulse rounded-xl2 bg-surface" />)}
    </div>
  )
}

export function ErrorCarga({ msg, reintentar }: { msg: string; reintentar: () => void }) {
  return (
    <Tarjeta className="text-center">
      <p className="font-semibold">No se pudieron cargar los datos</p>
      <p className="mt-1 text-sm text-ink-3">{msg}</p>
      <button type="button" className={`${btnSecundario} mt-3`} onClick={reintentar}>Reintentar</button>
    </Tarjeta>
  )
}

export function Sigla({ categoria }: { categoria: string }) {
  const c = CATEGORIAS.find(x => x.id === categoria)
  return (
    <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-[12px] font-bold text-ink-2">
      {c?.sigla ?? 'OT'}
    </span>
  )
}

/** Números de 5+ dígitos dentro de una nota (suministro, cuenta, CCI, celular). Admite guiones y espacios internos. */
const NUMERO = /\d[\d -]{3,}\d/g

function BotonCopiar({ texto, etiqueta }: { texto: string; etiqueta: string }) {
  const [ok, setOk] = useState(false)
  async function copiar(e: React.MouseEvent<HTMLButtonElement>) {
    const boton = e.currentTarget
    const limpio = texto.replace(/[\s-]/g, '')
    try {
      await navigator.clipboard.writeText(/^\d+$/.test(limpio) ? limpio : texto)
    } catch {
      // Sin permiso de portapapeles: dejamos el texto seleccionado para copiarlo a mano
      const sel = window.getSelection()
      const rango = document.createRange()
      rango.selectNodeContents(boton.querySelector('span') ?? boton)
      sel?.removeAllRanges(); sel?.addRange(rango)
      return
    }
    setOk(true)
    setTimeout(() => setOk(false), 1600)
  }
  return (
    <button type="button" onClick={copiar} aria-label={`Copiar ${etiqueta}`}
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 align-baseline font-semibold transition ${
        ok ? 'bg-good/15 text-good' : 'bg-surface-2 text-ink hover:bg-accent-soft hover:text-accent'}`}>
      <span className="num select-all break-all">{ok ? 'Copiado' : texto}</span>
      {ok ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5 text-ink-3" />}
    </button>
  )
}

/**
 * Nota de referencia de un gasto (ej. "Código de Suministro 844606") con botón de copiar.
 * Cada número se copia por separado y sin espacios ni guiones; si no hay números, se copia la nota entera.
 */
export function NotaCopiable({ nota }: { nota: string }) {
  const numeros = [...nota.matchAll(NUMERO)]
  // Sin números no hay nada útil que pegar en el banco: se muestra como texto
  if (!numeros.length) return <p className="text-xs text-ink-2">{nota}</p>
  const partes: React.ReactNode[] = []
  let desde = 0
  numeros.forEach((m, i) => {
    if (m.index! > desde) partes.push(<span key={`t${i}`}>{nota.slice(desde, m.index)}</span>)
    partes.push(<BotonCopiar key={`n${i}`} texto={m[0].trim()} etiqueta={m[0].trim()} />)
    desde = m.index! + m[0].length
  })
  if (desde < nota.length) partes.push(<span key="fin">{nota.slice(desde)}</span>)
  return <p className="flex flex-wrap items-center gap-x-1 gap-y-1 text-xs text-ink-2">{partes}</p>
}

/** Tinte sutil de la fila según a quién le toca (Ambos: sin tinte). */
export function tintePersona(a: Asignacion | null | undefined) {
  return a === '1' ? 'bg-p1/[0.07]' : a === '2' ? 'bg-p2/[0.08]' : ''
}

/** Nombre de quién paga con su color; "Tú" si es la persona que está usando la app. */
export function EtiquetaPersona({ a, personas, yo }: { a: Asignacion; personas: [Persona, Persona]; yo?: PersonaId | null }) {
  if (a === 'ambos') return <span className="font-semibold text-ink-3">Ambos</span>
  const p = personas[a === '1' ? 0 : 1]
  return (
    <span className={`inline-flex items-center gap-1 font-semibold ${a === '1' ? 'text-p1' : 'text-p2'}`}>
      <i className={`inline-block h-2 w-2 rounded-full ${a === '1' ? 'bg-p1' : 'bg-p2'}`} />
      {a === yo ? 'Tú' : nombreCorto(p)}
    </span>
  )
}

/** Filtro "Todos / Míos": recuerda la elección en este navegador. */
export function useSoloMios() {
  const [solo, setSolo] = useState(false)
  useEffect(() => { try { setSolo(localStorage.getItem('cuentas-claras:solo-mios') === '1') } catch { /* sin almacenamiento */ } }, [])
  const cambiar = (v: boolean) => { setSolo(v); try { localStorage.setItem('cuentas-claras:solo-mios', v ? '1' : '0') } catch { /* nada */ } }
  return [solo, cambiar] as const
}

export function FiltroMios({ solo, onCambio, persona }: { solo: boolean; onCambio: (v: boolean) => void; persona: Persona | null }) {
  if (!persona) return null
  const color = persona.id === '1' ? 'bg-p1' : 'bg-p2'
  return (
    <div role="radiogroup" aria-label="Qué gastos mostrar" className="inline-flex rounded-full bg-surface-2 p-0.5 text-xs font-semibold">
      <button type="button" role="radio" aria-checked={!solo} onClick={() => onCambio(false)}
        className={`rounded-full px-3 py-1 ${!solo ? 'bg-surface text-ink shadow-sm' : 'text-ink-3'}`}>Todos</button>
      <button type="button" role="radio" aria-checked={solo} onClick={() => onCambio(true)}
        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 ${solo ? 'bg-surface text-ink shadow-sm' : 'text-ink-3'}`}>
        <i className={`h-2 w-2 rounded-full ${color}`} />Míos
      </button>
    </div>
  )
}

/** Vuelve a cargar los datos (en el acceso directo del celular no existe "jalar para actualizar"). */
export function BotonActualizar() {
  const [girando, setGirando] = useState(false)
  return (
    <button type="button" aria-label="Actualizar" title="Actualizar"
      onClick={() => { setGirando(true); recargarTodo(); setTimeout(() => setGirando(false), 700) }}
      className="grid h-9 w-9 place-items-center rounded-full text-ink-3 transition hover:bg-surface-2 hover:text-ink">
      <RefreshCw className={`h-[18px] w-[18px] ${girando ? 'animate-spin' : ''}`} />
    </button>
  )
}
