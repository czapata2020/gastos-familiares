'use client'

import Link from 'next/link'
import { Check, ArrowRight } from 'lucide-react'
import type { EstadoMes, FilaMes } from '@/types'
import type { Metricas } from '@/lib/metricas'
import { api, dinero, useDatos, usePeriodo } from '@/lib/cliente'
import { dividir, estadoFila, MESES } from '@/lib/reparto'
import { Avatar, BarraReparto, btnPrimario, Cargando, Encabezado, ErrorCarga, MesSelector, nombreCorto, PillEstado, Seccion, Sigla, Tarjeta, useAviso } from '@/components/ui'

export default function Inicio() {
  const { anio, mes, mover, query } = usePeriodo()
  const { data, error, recargar, setData } = useDatos<EstadoMes>(`/api/mes?anio=${anio}&mes=${mes}`)
  const met = useDatos<{ metricas: Metricas; anterior: Metricas }>(`/api/metricas?anio=${anio}&mes=${mes}`)
  const { aviso, nodo } = useAviso()

  const enc = <Encabezado titulo="Inicio"><MesSelector anio={anio} mes={mes} mover={mover} /></Encabezado>
  if (error) return <>{enc}<ErrorCarga msg={error} reintentar={recargar} /></>
  if (!data || data.anio !== anio || data.mes !== mes) return <>{enc}<Cargando /></>

  const { personas, porcentaje1: pct1, config } = data
  const mon = config.monedaBase
  const registrados = data.filas.filter(f => f.pago)
  let total = 0, a = 0, b = 0, pagado = 0
  for (const f of registrados) {
    const [x, y] = dividir(f.pago!.monto, f.pago!.asignadoA, pct1)
    total += f.pago!.monto; a += x; b += y
    if (f.pago!.pagado) pagado += f.pago!.monto
  }
  const pendientes = data.filas.filter(f => !f.pago?.pagado)
  const orden = { vencido: 0, 'por-vencer': 1, pendiente: 2, 'sin-registrar': 3, pagado: 4 }
  pendientes.sort((x, y) => orden[estadoFila(x, anio, mes)] - orden[estadoFila(y, anio, mes)])

  const totalPrevio = mes === 1 ? met.data?.anterior.meses[11].total : met.data?.metricas.meses[mes - 2].total
  const delta = totalPrevio ? ((total - totalPrevio) / totalPrevio) * 100 : null

  async function marcarPagado(f: FilaMes) {
    const monto = f.pago?.monto ?? f.montoSugerido
    if (monto == null) { aviso('Primero ingresa el monto en Registrar', true); return }
    setData(d => d && { ...d, filas: d.filas.map(x => x.key === f.key ? { ...x, pago: { ...(x.pago ?? fakePago(x, anio, mes, monto)), pagado: true } } : x) })
    try {
      if (f.pago) await api(`/api/pagos/${f.pago.id}`, 'PATCH', { pagado: true })
      else await api('/api/pagos', 'POST', {
        conceptoId: f.concepto?.id, nombre: f.nombre, categoria: f.categoria, tipo: f.tipo, anio, mes, monto,
        asignadoA: f.asignacionSugerida ?? f.concepto?.asignadoDefault ?? 'ambos', pagado: true,
      })
      aviso(`${f.nombre} marcado como pagado`)
    } catch (e) { aviso((e as Error).message, true) }
    void recargar(); void met.recargar()
  }

  const sinNada = data.filas.length === 0

  return (
    <>
      {enc}
      {nodo}
      <div className="grid gap-5">
        <section className="rounded-[22px] bg-accent p-5 text-accent-ink">
          <p className="text-sm opacity-80">Gastos de {MESES[mes - 1].toLowerCase()}</p>
          <p className="num font-display text-[38px] font-bold leading-tight">{dinero(total, mon)}</p>
          {delta != null && (
            <p className="num text-sm opacity-90">{delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}% vs {MESES[(mes + 10) % 12].toLowerCase()}</p>
          )}
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-accent-ink/25">
            <i className="block h-full rounded-full bg-accent-ink/90" style={{ width: `${total ? (pagado / total) * 100 : 0}%` }} />
          </div>
          <p className="num mt-1.5 text-sm opacity-90">
            {dinero(pagado, mon)} pagado · {registrados.filter(f => f.pago!.pagado).length}/{data.filas.length} gastos
          </p>
        </section>

        <div className="grid grid-cols-2 gap-3">
          {personas.map((p, i) => {
            const real = i === 0 ? a : b
            const justo = i === 0 ? pct1 : 100 - pct1
            return (
              <Tarjeta key={p.id} className="grid gap-1 !p-3.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-ink-2"><Avatar persona={p} size={22} />{nombreCorto(p)}</div>
                <p className="num font-display text-[22px] font-bold">{dinero(real, mon)}</p>
                <p className="num text-xs text-ink-3">{total ? ((real / total) * 100).toFixed(0) : 0}% real · {justo.toFixed(0)}% por salario</p>
              </Tarjeta>
            )
          })}
        </div>
        {total > 0 && <BarraReparto a={a} b={b} />}

        {sinNada ? (
          <Tarjeta className="grid gap-3 text-center">
            <p className="font-display text-lg font-bold">Todavía no hay gastos</p>
            <p className="text-sm text-ink-2">Crea tus gastos recurrentes (hipoteca, luz, nana…) una vez en Ajustes y aparecerán solos cada mes.</p>
            <Link href={`/ajustes${query}`} className={`${btnPrimario} justify-self-center`}>Ir a Ajustes <ArrowRight className="h-4 w-4" /></Link>
          </Tarjeta>
        ) : (
          <Seccion titulo="Por pagar" extra={`${pendientes.length} pendientes`}>
            <Tarjeta className="!py-1">
              {pendientes.length === 0 && <p className="py-6 text-center text-sm text-ink-2">Todo pagado este mes.</p>}
              {pendientes.map(f => {
                const estado = estadoFila(f, anio, mes)
                const monto = f.pago?.monto ?? f.montoSugerido
                const asign = f.pago?.asignadoA ?? f.asignacionSugerida ?? f.concepto?.asignadoDefault ?? 'ambos'
                return (
                  <div key={f.key} className="flex items-center gap-3 border-t border-line py-3 first:border-0">
                    <Sigla categoria={f.categoria} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold">{f.nombre}</p>
                      {f.pago?.nota && <p className="truncate text-xs text-ink-2">{f.pago.nota}</p>}
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
                        <PillEstado estado={estado} dia={f.diaVencimiento} />
                        <span>{asign === 'ambos' ? 'Ambos' : nombreCorto(personas[asign === '1' ? 0 : 1])}</span>
                      </div>
                    </div>
                    <span className={`num text-[15px] font-bold ${monto == null ? 'text-ink-3' : ''}`}>{monto == null ? '—' : dinero(monto, mon)}</span>
                    <button type="button" onClick={() => marcarPagado(f)} aria-label={`Marcar ${f.nombre} como pagado`}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-line text-ink-3 transition hover:border-good hover:text-good">
                      <Check className="h-4 w-4" strokeWidth={3} />
                    </button>
                  </div>
                )
              })}
            </Tarjeta>
            <Link href={`/registrar${query}`} className="px-1 text-sm font-semibold text-accent">Editar montos y asignaciones →</Link>
          </Seccion>
        )}
      </div>
    </>
  )
}

function fakePago(f: FilaMes, anio: number, mes: number, monto: number) {
  return {
    id: f.key, conceptoId: f.concepto?.id ?? null, nombre: f.nombre, categoria: f.categoria, tipo: f.tipo, anio, mes,
    monto, asignadoA: f.asignacionSugerida ?? f.concepto?.asignadoDefault ?? 'ambos' as const, pagado: false, fechaPago: null, nota: '',
    asignacionManual: false,
  }
}
