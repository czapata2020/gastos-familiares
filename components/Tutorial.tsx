'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { X } from 'lucide-react'

/**
 * Recorrido guiado para quien entra por primera vez. Ilumina partes reales de la pantalla
 * (marcadas con data-tour="…") y explica qué hacer. Se muestra una vez por persona y navegador;
 * se puede omitir y volver a ver desde Ajustes (?tutorial=1).
 */

interface Paso {
  /** data-tour del elemento a iluminar; sin objetivo = tarjeta centrada */
  objetivo?: string
  titulo: string
  texto: string
  consejo?: string
}

const pasos = (nombre: string): Paso[] => [
  {
    titulo: `Hola${nombre ? ` ${nombre}` : ''} 👋`,
    texto: 'Cuentas Claras reparte los gastos de la casa según el ingreso de cada uno. Cada persona tiene su grupo de gastos y los paga completos: nadie le deposita partes al otro. Te muestro en un minuto cómo usarla.',
  },
  {
    objetivo: 'resumen',
    titulo: 'El mes de un vistazo',
    texto: 'Arriba ves cuánto suman los gastos del mes y cuánto ya está pagado. Con las flechas del mes puedes ir a meses anteriores o siguientes.',
  },
  {
    objetivo: 'personas',
    titulo: 'Tu parte',
    texto: 'Cuánto le toca a cada uno este mes, el % real y el % que corresponde por ingreso. La app reparte los gastos para que el año cuadre con ese %.',
  },
  {
    objetivo: 'pendiente',
    titulo: 'Lo que hay que pagar',
    texto: 'Cada gasto dice a quién le toca y cuándo vence. Cuando lo pagues, toca el círculo ✓ de la derecha y queda marcado.',
    consejo: 'Si el gasto tiene su número de cuenta, suministro o Yape, tócalo: se copia solo para pegarlo en la app de tu banco.',
  },
  {
    objetivo: 'nav-registrar',
    titulo: 'Registrar: montos del mes',
    texto: 'En Registrar están todos los gastos del mes. Escribe el monto real (por ejemplo, cuando llega el recibo de la luz) y se guarda solo al salir del campo. Ahí también marcas pagados.',
    consejo: 'Los gastos fijos ya traen su monto. Solo cambia lo que fue distinto.',
  },
  {
    objetivo: 'nav-registrar',
    titulo: 'Un gasto que no es mensual',
    texto: 'Farmacia, un regalo, una reparación… En Registrar, abajo, toca "+ Gasto ocasional". Queda a tu nombre y la app lo compensa en los meses siguientes.',
  },
  {
    titulo: 'También por WhatsApp',
    texto: 'Escríbele al +51 969 313 680 desde tu WhatsApp, como a una persona:\n• "luz 186": registra el monto del mes\n• "pagué la hipoteca": la marca pagada\n• "pendientes": qué falta pagar\n• "resumen": cómo van',
    consejo: 'Antes de guardar, el bot te pide confirmar con un botón. Si no te responde, pide un código de vinculación en Ajustes.',
  },
  {
    objetivo: 'nav-metricas',
    titulo: 'Métricas',
    texto: 'Cómo va el año mes a mes, en qué se gasta más y el balance: lo que cada uno pagó contra lo que le tocaba por ingreso.',
  },
  {
    titulo: '¡Listo!',
    texto: 'Eso es todo. Si quieres volver a ver esta guía, está en Ajustes → "Ver tutorial".',
  },
]

const CLAVE = (email: string) => `cuentas-claras:tutorial-v1:${email || 'anonimo'}`

function leerVisto(email: string) {
  try { return localStorage.getItem(CLAVE(email)) === '1' } catch { return false }
}
function marcarVisto(email: string) {
  try { localStorage.setItem(CLAVE(email), '1') } catch { /* modo privado: se volverá a mostrar */ }
}

/** El elemento visible con ese data-tour (hay dos menús: lateral en escritorio e inferior en celular). */
function buscar(objetivo?: string): HTMLElement | null {
  if (!objetivo) return null
  const todos = [...document.querySelectorAll<HTMLElement>(`[data-tour="${objetivo}"]`)]
  return todos.find(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 }) ?? null
}

export default function Tutorial() {
  const pathname = usePathname()
  const sp = useSearchParams()
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [i, setI] = useState(0)
  const [yo, setYo] = useState({ nombre: '', email: '' })
  const [caja, setCaja] = useState<DOMRect | null>(null)
  const tarjeta = useRef<HTMLDivElement>(null)

  // Quién soy (para saludar y recordar que ya lo vi) y si corresponde mostrarlo
  useEffect(() => {
    if (pathname !== '/') return
    let cancelado = false
    fetch('/api/ajustes', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => {
      if (cancelado || !d) return
      const email: string = d.usuario ?? ''
      const p = (d.personas ?? []).find((x: { email: string }) => x.email && x.email.toLowerCase() === email.toLowerCase())
      setYo({ nombre: (p?.nombre ?? '').split(' ')[0], email })
      if (sp.get('tutorial') === '1' || !leerVisto(email)) { setI(0); setAbierto(true) }
    }).catch(() => {})
    return () => { cancelado = true }
  }, [pathname, sp])

  const lista = useMemo(() => pasos(yo.nombre), [yo.nombre])
  const paso = lista[i]
  const objetivo = paso?.objetivo

  // Ubicar el elemento iluminado (y seguirlo si la pantalla se mueve). Solo se actualiza si cambió:
  // si no, cada medición provocaría otro dibujo y otra medición sin fin.
  const medir = useCallback(() => {
    const el = buscar(objetivo)
    const r = el?.getBoundingClientRect() ?? null
    setCaja(antes => {
      if (!r) return antes === null ? antes : null
      if (antes && antes.left === r.left && antes.top === r.top && antes.width === r.width && antes.height === r.height) return antes
      return r
    })
  }, [objetivo])

  useLayoutEffect(() => {
    if (!abierto) return
    const el = buscar(objetivo)
    if (el && getComputedStyle(el).position !== 'fixed' && !el.closest('nav')) {
      // Dejar el elemento arriba, con lugar debajo para la tarjeta (~400px)
      const r = el.getBoundingClientRect()
      if (r.top < 70 || r.bottom > window.innerHeight - 400) window.scrollBy({ top: r.top - 90, behavior: 'instant' as ScrollBehavior })
    }
    medir()
    const t = setTimeout(medir, 350)   // los datos del mes pueden terminar de cargar después
    window.addEventListener('resize', medir)
    window.addEventListener('scroll', medir, true)
    return () => { clearTimeout(t); window.removeEventListener('resize', medir); window.removeEventListener('scroll', medir, true) }
  }, [abierto, i, medir, objetivo])

  // Si la tarjeta no entra completa en la pantalla, se sube lo justo (se mide la real, no una estimación)
  useLayoutEffect(() => {
    const el = tarjeta.current
    if (!abierto || !el) return
    el.style.translate = ''
    const r = el.getBoundingClientRect()
    const limite = window.innerHeight - 12
    if (r.bottom > limite) el.style.translate = `0 ${-(r.bottom - limite)}px`
    else if (r.top < 12) el.style.translate = `0 ${12 - r.top}px`
  })

  const cerrar = useCallback(() => {
    marcarVisto(yo.email)
    setAbierto(false)
    if (sp.get('tutorial')) router.replace('/', { scroll: false })
  }, [yo.email, sp, router])

  useEffect(() => {
    if (!abierto) return
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar()
      if (e.key === 'ArrowRight') setI(n => Math.min(n + 1, lista.length - 1))
      if (e.key === 'ArrowLeft') setI(n => Math.max(n - 1, 0))
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [abierto, cerrar, lista.length])

  if (!abierto || !paso) return null
  const ultimo = i === lista.length - 1
  const margen = 8

  // Tarjeta debajo del elemento si cabe; si no, encima; si tampoco, fija abajo de la pantalla.
  // Sin elemento: al centro.
  const ALTO_TARJETA = 300
  let estiloTarjeta: React.CSSProperties = { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
  if (caja) {
    const alto = window.innerHeight
    if (alto - caja.bottom > ALTO_TARJETA) estiloTarjeta = { left: '50%', top: caja.bottom + margen + 10, transform: 'translateX(-50%)' }
    else if (caja.top > ALTO_TARJETA) estiloTarjeta = { left: '50%', bottom: alto - caja.top + margen + 10, transform: 'translateX(-50%)' }
    else estiloTarjeta = { left: '50%', bottom: 'calc(5.5rem + env(safe-area-inset-bottom))', transform: 'translateX(-50%)' }
  }

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-labelledby="tutorial-titulo">
      {/* Fondo oscuro con un hueco sobre el elemento explicado */}
      {caja ? (
        <div className="pointer-events-none fixed rounded-2xl transition-all duration-200"
          style={{
            left: caja.left - margen, top: caja.top - margen, width: caja.width + margen * 2, height: caja.height + margen * 2,
            boxShadow: '0 0 0 9999px rgb(0 0 0 / 0.6)', outline: '2px solid rgb(var(--accent))',
          }} />
      ) : <div className="fixed inset-0 bg-black/60" />}
      <div className="fixed inset-0" onClick={e => e.stopPropagation()} />

      <div ref={tarjeta} className="fixed max-h-[calc(100dvh-24px)] w-[min(92vw,380px)] overflow-y-auto rounded-2xl bg-surface p-5 shadow-2xl" style={estiloTarjeta}>
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-accent">Paso {i + 1} de {lista.length}</span>
          <button type="button" onClick={cerrar} aria-label="Cerrar tutorial" className="grid h-8 w-8 place-items-center rounded-full text-ink-3 hover:bg-surface-2">
            <X className="h-4 w-4" />
          </button>
        </div>
        <h2 id="tutorial-titulo" className="font-display text-lg font-bold">{paso.titulo}</h2>
        <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink-2">{paso.texto}</p>
        {paso.consejo && (
          <p className="mt-3 rounded-xl bg-accent-soft px-3 py-2 text-sm text-ink"><b className="text-accent">Consejo: </b>{paso.consejo}</p>
        )}
        <div className="mt-4 flex items-center justify-between gap-2">
          {!ultimo ? <button type="button" onClick={cerrar} className="-ml-2 px-2 py-2 text-sm font-semibold text-ink-3 hover:text-ink">Omitir</button> : <span />}
          <div className="flex items-center gap-2">
            {i > 0 && <button type="button" onClick={() => setI(i - 1)} className="rounded-full border border-line px-3.5 py-2 text-sm font-semibold">Atrás</button>}
            <button type="button" autoFocus onClick={() => (ultimo ? cerrar() : setI(i + 1))}
              className="rounded-full bg-accent px-4 py-2 text-sm font-bold text-accent-ink">
              {ultimo ? 'Empezar' : i === 0 ? 'Ver cómo' : 'Siguiente'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
