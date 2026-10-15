'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Copy, NotebookPen, Plus, Sparkles, Trash2, Wand2 } from 'lucide-react'
import type { Asignacion, Categoria, Concepto, EstadoMes, FilaMes, Persona } from '@/types'
import { api, dinero, parseMonto, useDatos, usePeriodo } from '@/lib/cliente'
import { dividir, estadoFila, montoFila } from '@/lib/reparto'
import { CATEGORIAS } from '@/lib/categorias'
import {
  btnPrimario, btnSecundario, Cargando, Chips, Encabezado, ErrorCarga, Hoja, inputCls, MesSelector, nombreCorto,
  PillEstado, Seccion, Sigla, Tarjeta, useAviso,
} from '@/components/ui'

const TITULOS = { fijo: 'Fijos', variable: 'Variables', ocasional: 'Ocasionales' } as const

export default function Registrar() {
  const { anio, mes, mover, query } = usePeriodo()
  const { data, error, recargar } = useDatos<EstadoMes>(`/api/mes?anio=${anio}&mes=${mes}`)
  const { aviso, nodo } = useAviso()
  const [hojaAbierta, setHojaAbierta] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  const enc = <Encabezado titulo="Registrar"><MesSelector anio={anio} mes={mes} mover={mover} /></Encabezado>
  if (error) return <>{enc}<ErrorCarga msg={error} reintentar={recargar} /></>
  if (!data || data.anio !== anio || data.mes !== mes) return <>{enc}<Cargando /></>

  const { personas, porcentaje1: pct1, config } = data
  const mon = config.monedaBase
  const sinRegistrar = data.filas.filter(f => !f.pago)
  let total = 0, a = 0, b = 0
  for (const f of data.filas) if (f.pago) {
    const [x, y] = dividir(f.pago.monto, f.pago.asignadoA, pct1)
    total += f.pago.monto; a += x; b += y
  }

  async function registrarTodos(origen: 'sugerido' | 'mes-anterior') {
    setOcupado(true)
    try {
      const r = await api<{ creados: number }>('/api/mes/registrar', 'POST', { anio, mes, origen })
      aviso(r.creados ? `${r.creados} gastos registrados` : 'No había montos para completar')
      await recargar()
    } catch (e) { aviso((e as Error).message, true) } finally { setOcupado(false) }
  }

  // Reparto de los recurrentes (registrados o por registrar) frente al objetivo por ingreso
  const auto = config.asignacionAuto
  let r1 = 0, r2 = 0
  for (const f of data.filas) {
    if (f.tipo === 'ocasional' || !f.concepto) continue
    const m = montoFila(f)
    if (m == null) continue
    const quien = f.pago?.asignadoA ?? f.asignacionSugerida ?? f.concepto.asignadoDefault
    const [x, y] = dividir(m, quien, pct1)
    r1 += x; r2 += y
  }
  const rTotal = r1 + r2

  const grupos = (['fijo', 'variable', 'ocasional'] as const)
    .map(t => ({ tipo: t, filas: data.filas.filter(f => f.tipo === t) }))
    .filter(g => g.filas.length)

  return (
    <>
      {enc}
      {nodo}
      <div className="grid gap-5">
        {sinRegistrar.length > 0 && (
          <Tarjeta className="grid gap-3 !bg-accent-soft ring-0">
            <p className="text-sm"><b>{sinRegistrar.length} gastos recurrentes</b> sin registrar en este mes. Puedes completarlos de una vez y luego ajustar.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btnSecundario} disabled={ocupado} onClick={() => registrarTodos('sugerido')}>
                <Sparkles className="h-4 w-4" />Montos de referencia
              </button>
              <button type="button" className={btnSecundario} disabled={ocupado} onClick={() => registrarTodos('mes-anterior')}>
                <Copy className="h-4 w-4" />Copiar mes anterior
              </button>
            </div>
          </Tarjeta>
        )}

        {auto && rTotal > 0 && (
          <Tarjeta className="grid gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold"><Wand2 className="h-4 w-4 text-accent" />Asignación automática de recurrentes</div>
            <div className="flex gap-0.5 overflow-hidden rounded-md" style={{ height: 10 }}>
              <i className="block bg-p1" style={{ width: `${(r1 / rTotal) * 100}%` }} /><i className="block flex-1 bg-p2" />
            </div>
            <div className="num flex flex-wrap justify-between gap-x-3 text-sm">
              <span><b className="text-p1">{nombreCorto(personas[0])}</b> {dinero(r1, mon)} · {((r1 / rTotal) * 100).toFixed(0)}%</span>
              <span><b className="text-p2">{nombreCorto(personas[1])}</b> {dinero(r2, mon)} · {((r2 / rTotal) * 100).toFixed(0)}%</span>
            </div>
            <p className="text-xs text-ink-3">
              Objetivo por ingreso: {pct1.toFixed(0)}% / {(100 - pct1).toFixed(0)}%.
              {Math.abs(data.arrastre1) >= 1 && <> Este mes compensa lo de meses anteriores: {nombreCorto(personas[data.arrastre1 > 0 ? 0 : 1])} venía cargando {dinero(Math.abs(data.arrastre1), mon)} de más.</>}
              {' '}Cada gasto va completo a una persona; los pagados y los que eliges a mano no se mueven. Los ocasionales se asignan aparte.
            </p>
            {data.filas.some(f => f.pago && !f.pago.pagado && f.pago.asignacionManual && f.tipo !== 'ocasional') && (
              <button type="button" className={`${btnSecundario} justify-self-start`} disabled={ocupado} onClick={async () => {
                setOcupado(true)
                try { await api('/api/mes/automatico', 'POST', { anio, mes }); aviso('Mes reasignado automáticamente'); await recargar() }
                catch (e) { aviso((e as Error).message, true) } finally { setOcupado(false) }
              }}><Wand2 className="h-4 w-4" />Pasar todo el mes a automático</button>
            )}
          </Tarjeta>
        )}

        {grupos.length === 0 && (
          <Tarjeta className="grid gap-2 text-center">
            <p className="font-display text-lg font-bold">Nada para este mes todavía</p>
            <p className="text-sm text-ink-2">Agrega un gasto ocasional abajo o crea tus gastos recurrentes en <Link className="font-semibold text-accent" href={`/ajustes${query}`}>Ajustes</Link>.</p>
          </Tarjeta>
        )}

        {grupos.map(g => (
          <Seccion key={g.tipo} titulo={TITULOS[g.tipo]} extra={`${g.filas.filter(f => f.pago?.pagado).length}/${g.filas.length} pagados`}>
            <Tarjeta className="!py-0">
              {g.filas.map(f => (
                <FilaEditable key={f.key} f={f} anio={anio} mes={mes} personas={personas} auto={auto}
                  onCambio={recargar} onError={m => aviso(m, true)} />
              ))}
            </Tarjeta>
          </Seccion>
        ))}

        <button type="button" onClick={() => setHojaAbierta(true)} className={`${btnPrimario} justify-self-start`}>
          <Plus className="h-4 w-4" />Gasto ocasional
        </button>
      </div>

      {/* Totales fijos sobre la barra inferior */}
      <div className="sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-20 mt-6 md:bottom-4">
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-3 text-bg shadow-xl">
          <div>
            <p id="moneda-mes" className="text-[11px] font-semibold uppercase tracking-wide opacity-70">Total del mes · {mon}</p>
            <p className="num font-display text-lg font-bold">{dinero(total, mon)}</p>
          </div>
          <div className="num text-right text-[13px] leading-snug">
            <p><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-p1" />{nombreCorto(personas[0])} {dinero(a, mon)}</p>
            <p><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-p2" />{nombreCorto(personas[1])} {dinero(b, mon)}</p>
          </div>
        </div>
      </div>

      <HojaOcasional abierta={hojaAbierta} onCerrar={() => setHojaAbierta(false)} plantillas={data.ocasionales}
        personas={personas} anio={anio} mes={mes} moneda={mon}
        onGuardado={async nombre => { setHojaAbierta(false); aviso(`${nombre} agregado`); await recargar() }}
        onError={m => aviso(m, true)} />
    </>
  )
}

function FilaEditable({ f, anio, mes, personas, auto, onCambio, onError }: {
  f: FilaMes; anio: number; mes: number; personas: [Persona, Persona]; auto: boolean
  onCambio: () => Promise<void>; onError: (m: string) => void
}) {
  const asignInicial = (): Asignacion => f.pago?.asignadoA ?? f.asignacionSugerida ?? f.concepto?.asignadoDefault ?? 'ambos'
  const [monto, setMonto] = useState(f.pago ? String(f.pago.monto) : '')
  const [asign, setAsign] = useState<Asignacion>(asignInicial)
  const [pagado, setPagado] = useState(f.pago?.pagado ?? false)
  const [nota, setNota] = useState(f.pago?.nota ?? '')
  const [editandoNota, setEditandoNota] = useState(false)
  const [confirmarBorrar, setConfirmarBorrar] = useState(false)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    setMonto(f.pago ? String(f.pago.monto) : '')
    setAsign(asignInicial())
    setPagado(f.pago?.pagado ?? false)
    setNota(f.pago?.nota ?? '')
  }, [f.pago, f.concepto, f.asignacionSugerida]) // eslint-disable-line react-hooks/exhaustive-deps

  const guardar = useCallback(async (cambios: { monto?: number; asignadoA?: Asignacion; pagado?: boolean; automatico?: boolean; nota?: string }) => {
    setGuardando(true)
    try {
      if (f.pago) {
        await api(`/api/pagos/${f.pago.id}`, 'PATCH', cambios)
      } else {
        const m = cambios.monto ?? parseMonto(monto) ?? f.montoSugerido
        if (m == null) { onError(`Ingresa el monto de ${f.nombre}`); return false }
        await api('/api/pagos', 'POST', {
          conceptoId: f.concepto?.id, nombre: f.nombre, categoria: f.categoria, tipo: f.tipo, anio, mes, monto: m,
          asignadoA: cambios.asignadoA ?? asign, pagado: cambios.pagado ?? pagado,
          manual: cambios.asignadoA !== undefined, nota: cambios.nota ?? nota,
        })
      }
      await onCambio()
      return true
    } catch (e) {
      onError((e as Error).message)
      return false
    } finally { setGuardando(false) }
  }, [f, monto, asign, pagado, anio, mes, onCambio, onError])

  async function alSalirDelMonto() {
    const n = parseMonto(monto)
    if (monto.trim() === '') { if (f.pago) setMonto(String(f.pago.monto)); return }
    if (n == null) { onError('Monto inválido'); return }
    if (f.pago && n === f.pago.monto) return
    await guardar({ monto: n })
  }

  async function cambiarAsign(x: Asignacion) {
    setAsign(x)
    if (f.pago || parseMonto(monto) != null || f.montoSugerido != null) await guardar({ asignadoA: x })
  }

  async function guardarNota() {
    setEditandoNota(false)
    const limpia = nota.trim()
    if (limpia === (f.pago?.nota ?? '')) return
    if (!(await guardar({ nota: limpia }))) setNota(f.pago?.nota ?? '')
  }

  async function alternarPagado() {
    const nuevo = !pagado
    setPagado(nuevo)
    if (!(await guardar({ pagado: nuevo }))) setPagado(!nuevo)
  }

  async function borrar() {
    if (!f.pago) return
    if (!confirmarBorrar) { setConfirmarBorrar(true); setTimeout(() => setConfirmarBorrar(false), 3000); return }
    try { await api(`/api/pagos/${f.pago.id}`, 'DELETE'); await onCambio() } catch (e) { onError((e as Error).message) }
  }

  const estado = estadoFila({ ...f, pago: f.pago ? { ...f.pago, pagado } : null }, anio, mes)
  // Etiqueta de cómo se decidió a quién le toca (solo recurrentes con asignación automática)
  const recurrente = f.tipo !== 'ocasional' && !!f.concepto
  const modo = !auto || !recurrente ? null
    : f.pago?.pagado ? null
    : f.pago?.asignacionManual ? 'manual'
    : f.concepto!.asignadoDefault !== 'ambos' ? 'fijo' : 'auto'

  return (
    <div className={`grid gap-2 border-t border-line py-3 first:border-0 ${guardando ? 'opacity-70' : ''}`}>
      <div className="flex items-center gap-3">
        <Sigla categoria={f.categoria} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{f.nombre}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <PillEstado estado={estado} dia={f.diaVencimiento} />
            {f.esCuotaDoble && <span className="rounded-full bg-warn/10 px-2 py-0.5 text-[11px] font-bold text-warn">Cuota doble</span>}
          </div>
        </div>
        <label className="sr-only" htmlFor={`m-${f.key}`}>Monto de {f.nombre}</label>
        <div>
          <input id={`m-${f.key}`} inputMode="decimal" autoComplete="off" value={monto}
            placeholder={f.montoSugerido != null ? String(f.montoSugerido) : '0.00'} aria-describedby="moneda-mes"
            onChange={e => setMonto(e.target.value)} onBlur={alSalirDelMonto}
            onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className={`num w-[104px] rounded-xl border bg-surface-2 px-2.5 py-2 text-right font-semibold outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 ${
              f.pago ? 'border-line' : 'border-dashed border-ink-3/40'}`} />
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 pl-[52px]">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <Chips valor={asign} personas={personas} onChange={cambiarAsign} disabled={guardando} />
          {modo === 'auto' && <span className="text-[11px] font-semibold text-accent">Auto</span>}
          {modo === 'fijo' && <span className="text-[11px] text-ink-3">Siempre</span>}
          {modo === 'manual' && (
            <button type="button" onClick={() => guardar({ automatico: true })} className="text-[11px] font-semibold text-ink-3 underline underline-offset-2">
              A mano · volver a auto
            </button>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {!editandoNota && !nota && (
            <button type="button" onClick={() => setEditandoNota(true)} aria-label={`Agregar nota a ${f.nombre}`}
              className="grid h-9 w-9 place-items-center rounded-full text-ink-3 hover:text-ink">
              <NotebookPen className="h-4 w-4" />
            </button>
          )}
          {f.pago && (
            <button type="button" onClick={borrar} aria-label={confirmarBorrar ? 'Confirmar quitar registro' : 'Quitar registro'}
              className={`grid h-9 place-items-center rounded-full px-2 text-xs font-semibold transition ${confirmarBorrar ? 'bg-bad text-white' : 'text-ink-3 hover:text-bad'}`}>
              {confirmarBorrar ? '¿Quitar?' : <Trash2 className="h-4 w-4" />}
            </button>
          )}
          <button type="button" onClick={alternarPagado} aria-pressed={pagado} aria-label={pagado ? 'Marcar como pendiente' : 'Marcar como pagado'}
            className={`grid h-9 w-9 place-items-center rounded-full border-2 transition ${pagado ? 'border-good bg-good text-white' : 'border-line text-ink-3 hover:border-good hover:text-good'}`}>
            <Check className="h-4 w-4" strokeWidth={3} />
          </button>
        </div>
      </div>
      {editandoNota ? (
        <div className="pl-[52px]">
          <label className="sr-only" htmlFor={`n-${f.key}`}>Nota de {f.nombre}</label>
          <input id={`n-${f.key}`} autoFocus maxLength={200} value={nota} placeholder="Ej. consumo septiembre, recibo N° 123"
            onChange={e => setNota(e.target.value)} onBlur={guardarNota}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setNota(f.pago?.nota ?? ''); setEditandoNota(false) } }}
            className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/25" />
        </div>
      ) : nota ? (
        <button type="button" onClick={() => setEditandoNota(true)} aria-label={`Editar nota de ${f.nombre}`}
          className="ml-[52px] flex min-w-0 items-center gap-1.5 text-left text-[13px] text-ink-2">
          <NotebookPen className="h-3.5 w-3.5 shrink-0 text-ink-3" /><span className="truncate">{nota}</span>
        </button>
      ) : null}
    </div>
  )
}

function HojaOcasional({ abierta, onCerrar, plantillas, personas, anio, mes, moneda, onGuardado, onError }: {
  abierta: boolean; onCerrar: () => void; plantillas: Concepto[]; personas: [Persona, Persona]
  anio: number; mes: number; moneda: string; onGuardado: (nombre: string) => Promise<void>; onError: (m: string) => void
}) {
  const vacio = { conceptoId: null as string | null, nombre: '', categoria: 'otro' as Categoria, monto: '', asignadoA: 'ambos' as Asignacion, pagado: true, plantilla: false, nota: '' }
  const [form, setForm] = useState(vacio)
  const [enviando, setEnviando] = useState(false)
  useEffect(() => { if (abierta) setForm(vacio) }, [abierta]) // eslint-disable-line react-hooks/exhaustive-deps

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    const monto = parseMonto(form.monto)
    if (!form.nombre.trim()) return onError('Escribe un nombre')
    if (monto == null) return onError('Monto inválido')
    setEnviando(true)
    try {
      let conceptoId = form.conceptoId
      if (!conceptoId && form.plantilla) {
        conceptoId = (await api<{ id: string }>('/api/conceptos', 'POST', {
          nombre: form.nombre, categoria: form.categoria, tipo: 'ocasional', montoRef: monto, asignadoDefault: form.asignadoA,
        })).id
      }
      await api('/api/pagos', 'POST', {
        conceptoId, nombre: form.nombre, categoria: form.categoria, tipo: 'ocasional', anio, mes, monto,
        asignadoA: form.asignadoA, pagado: form.pagado, nota: form.nota,
      })
      await onGuardado(form.nombre)
    } catch (err) { onError((err as Error).message) } finally { setEnviando(false) }
  }

  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo="Gasto ocasional">
      <form onSubmit={enviar} className="grid gap-4">
        {plantillas.length > 0 && (
          <div className="grid gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Frecuentes</p>
            <div className="flex flex-wrap gap-2">
              {plantillas.map(p => (
                <button key={p.id} type="button"
                  onClick={() => setForm({ ...form, conceptoId: p.id, nombre: p.nombre, categoria: p.categoria, monto: p.montoRef != null ? String(p.montoRef) : '', asignadoA: p.asignadoDefault, plantilla: false })}
                  className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${form.conceptoId === p.id ? 'border-accent bg-accent-soft text-accent' : 'border-line'}`}>
                  {p.nombre}
                </button>
              ))}
            </div>
          </div>
        )}
        <label className="grid gap-1 text-sm font-semibold text-ink-2">Nombre
          <input id="oc-nombre" className={inputCls} value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value, conceptoId: null })} placeholder="Ej. Cumpleaños, médico, regalo" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-sm font-semibold text-ink-2">Monto ({moneda})
            <input id="oc-monto" className={`${inputCls} num`} inputMode="decimal" value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })} placeholder="0.00" />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-ink-2">Categoría
            <select id="oc-cat" className={inputCls} value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value as Categoria })}>
              {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </label>
        </div>
        <label className="grid gap-1 text-sm font-semibold text-ink-2">Nota <span className="font-normal text-ink-3">(opcional)</span>
          <input id="oc-nota" className={inputCls} maxLength={200} value={form.nota} onChange={e => setForm({ ...form, nota: e.target.value })} placeholder="Ej. consumo septiembre" />
        </label>
        <div className="grid gap-1 text-sm font-semibold text-ink-2">¿Quién paga?
          <Chips valor={form.asignadoA} personas={personas} onChange={x => setForm({ ...form, asignadoA: x })} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input id="oc-pagado" type="checkbox" checked={form.pagado} onChange={e => setForm({ ...form, pagado: e.target.checked })} className="h-5 w-5 accent-[rgb(var(--accent))]" />
          Ya está pagado
        </label>
        {!form.conceptoId && (
          <label className="flex items-center gap-2 text-sm">
            <input id="oc-plantilla" type="checkbox" checked={form.plantilla} onChange={e => setForm({ ...form, plantilla: e.target.checked })} className="h-5 w-5 accent-[rgb(var(--accent))]" />
            Guardar en frecuentes
          </label>
        )}
        <button type="submit" className={btnPrimario} disabled={enviando}>{enviando ? 'Guardando…' : 'Agregar gasto'}</button>
      </form>
    </Hoja>
  )
}
