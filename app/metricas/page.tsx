'use client'

import type { Persona, Config } from '@/types'
import type { Metricas } from '@/lib/metricas'
import { dinero, useDatos, usePeriodo } from '@/lib/cliente'
import { MESES } from '@/lib/reparto'
import { nombreCategoria } from '@/lib/categorias'
import { BarrasHorizontales, LineaDeTiempo } from '@/components/graficos'
import { BarraReparto, Cargando, Encabezado, ErrorCarga, nombreCorto, Seccion, Tarjeta } from '@/components/ui'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Resp { config: Config; personas: [Persona, Persona]; metricas: Metricas; anterior: Metricas; anios: number[] }

function Delta({ v, inverso = false }: { v: number | null; inverso?: boolean }) {
  if (v == null || !Number.isFinite(v)) return <span className="text-ink-3">—</span>
  // Gastar más es "malo" (rojo); gastar menos, "bueno" (verde).
  const malo = inverso ? v < 0 : v > 0
  return <span className={`num font-semibold ${Math.abs(v) < 0.5 ? 'text-ink-3' : malo ? 'text-bad' : 'text-good'}`}>{v > 0 ? '▲' : v < 0 ? '▼' : ''} {Math.abs(v).toFixed(1)}%</span>
}

export default function MetricasPage() {
  const { anio, mes, ir } = usePeriodo()
  const { data, error, recargar } = useDatos<Resp>(`/api/metricas?anio=${anio}&mes=${mes}`)

  const enc = (
    <Encabezado titulo="Métricas">
      <div className="flex items-center gap-1 rounded-full bg-surface p-1 shadow-sm ring-1 ring-line">
        <button type="button" onClick={() => ir(anio - 1, mes)} aria-label="Año anterior" className="grid h-9 w-9 place-items-center rounded-full text-ink-2 hover:bg-surface-2"><ChevronLeft className="h-5 w-5" /></button>
        <span className="min-w-[64px] text-center font-display font-bold">{anio}</span>
        <button type="button" onClick={() => ir(anio + 1, mes)} aria-label="Año siguiente" className="grid h-9 w-9 place-items-center rounded-full text-ink-2 hover:bg-surface-2"><ChevronRight className="h-5 w-5" /></button>
      </div>
    </Encabezado>
  )
  if (error) return <>{enc}<ErrorCarga msg={error} reintentar={recargar} /></>
  if (!data || data.metricas.anio !== anio) return <>{enc}<Cargando /></>

  const { metricas: m, anterior, personas, config } = data
  const mon = config.monedaBase
  const nombres: [string, string] = [nombreCorto(personas[0]), nombreCorto(personas[1])]

  if (m.mesesConDatos === 0) {
    return <>{enc}<Tarjeta className="text-center"><p className="font-display text-lg font-bold">Sin datos en {anio}</p><p className="mt-1 text-sm text-ink-2">Registra pagos y aquí aparecerán la línea de tiempo, las variaciones y el balance.</p></Tarjeta></>
  }

  const foco = m.meses[mes - 1]
  const previo = mes === 1 ? anterior.meses[11] : m.meses[mes - 2]
  const vsPrevio = previo.total ? ((foco.total - previo.total) / previo.total) * 100 : null
  const vsProm = m.promedio ? ((foco.total - m.promedio) / m.promedio) * 100 : null
  // Comparación interanual: mismos meses con datos este año vs el anterior.
  const mesesComparables = m.meses.filter(x => x.registros > 0).map(x => x.mes)
  const acumAnterior = anterior.meses.filter(x => mesesComparables.includes(x.mes)).reduce((s, x) => s + x.total, 0)
  const vsAnio = acumAnterior ? ((m.acumulado - acumAnterior) / acumAnterior) * 100 : null
  const fijo = m.meses.reduce((s, x) => s + x.fijo, 0)
  const variable = m.meses.reduce((s, x) => s + x.variable, 0)
  const ocasional = m.meses.reduce((s, x) => s + x.ocasional, 0)
  const deudor = m.balance1 > 0 ? nombres[1] : nombres[0]
  const acreedor = m.balance1 > 0 ? nombres[0] : nombres[1]

  return (
    <>
      {enc}
      <div className="grid gap-5">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi titulo={`Acumulado ${anio}`} valor={dinero(m.acumulado, mon)} pie={<><Delta v={vsAnio} /> vs {anio - 1}</>} />
          <Kpi titulo="Promedio mensual" valor={dinero(m.promedio, mon)} pie={`${m.mesesConDatos} meses con datos`} />
          <Kpi titulo={MESES[mes - 1]} valor={dinero(foco.total, mon)} pie={<><Delta v={vsPrevio} /> vs mes anterior</>} />
          <Kpi titulo="Vs promedio" valor={foco.total ? `${foco.total >= m.promedio ? '+' : '−'}${dinero(Math.abs(foco.total - m.promedio), mon)}` : '—'} pie={<Delta v={foco.total ? vsProm : null} />} />
        </div>

        <Seccion titulo="Línea de tiempo" extra="toca un mes para verlo">
          <Tarjeta>
            <div className="mb-2 flex flex-wrap gap-4 text-xs font-semibold text-ink-2">
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-p1" />{nombres[0]}</span>
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-p2" />{nombres[1]}</span>
              <span className="flex items-center gap-1.5"><i className="w-4 border-t-2 border-dashed border-ink-2" />Promedio</span>
            </div>
            <LineaDeTiempo meses={m.meses} moneda={mon} nombres={nombres} mesFoco={mes} promedio={m.promedio} onElegir={x => ir(anio, x)} />
          </Tarjeta>
        </Seccion>

        <Seccion titulo="Balance justo del año" extra="lo pagado vs lo que tocaba por salario">
          <Tarjeta className="grid gap-3">
            <BarraReparto a={m.real1} b={m.acumulado - m.real1} alto={14} />
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[0, 1].map(i => {
                const real = i === 0 ? m.real1 : m.acumulado - m.real1
                const justo = i === 0 ? m.justo1 : m.acumulado - m.justo1
                return (
                  <div key={i}>
                    <p className="font-semibold">{nombres[i]}</p>
                    <p className="num text-ink-2">Pagó {dinero(real, mon)}</p>
                    <p className="num text-ink-3">Le tocaba {dinero(justo, mon)}</p>
                  </div>
                )
              })}
            </div>
            <p className="rounded-xl bg-surface-2 px-3 py-2.5 text-sm">
              {Math.abs(m.balance1) < 1
                ? 'Están a mano.'
                : <><b>{deudor}</b> le debe <b className="num">{dinero(Math.abs(m.balance1), mon)}</b> a {acreedor}. Se puede compensar asignándole a {deudor} los próximos gastos.</>}
            </p>
          </Tarjeta>
        </Seccion>

        <div className="grid gap-5 md:grid-cols-2">
          <Seccion titulo="Por categoría" extra={`${anio}`}>
            <Tarjeta>
              <BarrasHorizontales moneda={mon} filas={m.porCategoria.slice(0, 8).map(c => ({ etiqueta: nombreCategoria(c.categoria), valor: c.total }))} />
            </Tarjeta>
          </Seccion>
          <Seccion titulo="Tipo de gasto" extra={`${anio}`}>
            <Tarjeta>
              <BarrasHorizontales moneda={mon} filas={[
                { etiqueta: 'Fijos', valor: fijo }, { etiqueta: 'Variables', valor: variable }, { etiqueta: 'Ocasionales', valor: ocasional },
              ].filter(f => f.valor > 0)} />
            </Tarjeta>
          </Seccion>
        </div>

        <Seccion titulo={`Qué cambió en ${MESES[mes - 1].toLowerCase()}`} extra="vs promedio de meses anteriores">
          <Tarjeta className="!py-1">
            {m.variaciones.length === 0 && <p className="py-5 text-center text-sm text-ink-2">Sin variaciones relevantes este mes.</p>}
            {m.variaciones.map(v => (
              <div key={v.nombre} className="flex items-center justify-between gap-3 border-t border-line py-3 text-sm first:border-0">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{v.nombre}</p>
                  <p className="num text-xs text-ink-3">promedio {dinero(v.promedio, mon)} → {dinero(v.actual, mon)}</p>
                </div>
                <span className={`num whitespace-nowrap font-bold ${v.delta > 0 ? 'text-bad' : 'text-good'}`}>
                  {v.delta > 0 ? '+' : '−'}{dinero(Math.abs(v.delta), mon)}
                </span>
              </div>
            ))}
          </Tarjeta>
        </Seccion>

        <Seccion titulo="Mes a mes">
          <Tarjeta className="overflow-x-auto !p-0">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-ink-3">
                  <th className="px-4 py-3 font-semibold">Mes</th>
                  <th className="px-2 py-3 text-right font-semibold">Total</th>
                  <th className="px-2 py-3 text-right font-semibold">{nombres[0]}</th>
                  <th className="px-2 py-3 text-right font-semibold">{nombres[1]}</th>
                  <th className="px-2 py-3 text-right font-semibold">Vs anterior</th>
                  <th className="px-4 py-3 text-right font-semibold">% {nombres[0]}</th>
                </tr>
              </thead>
              <tbody>
                {m.meses.filter(x => x.registros > 0).map(x => {
                  const p = x.mes === 1 ? anterior.meses[11] : m.meses[x.mes - 2]
                  return (
                    <tr key={x.mes} onClick={() => ir(anio, x.mes)}
                      className={`num cursor-pointer border-t border-line ${x.mes === mes ? 'bg-accent-soft' : 'hover:bg-surface-2'}`}>
                      <td className="px-4 py-2.5 font-semibold">{MESES[x.mes - 1]}</td>
                      <td className="px-2 py-2.5 text-right font-semibold">{dinero(x.total, mon)}</td>
                      <td className="px-2 py-2.5 text-right">{dinero(x.persona1, mon)}</td>
                      <td className="px-2 py-2.5 text-right">{dinero(x.persona2, mon)}</td>
                      <td className="px-2 py-2.5 text-right"><Delta v={p.total ? ((x.total - p.total) / p.total) * 100 : null} /></td>
                      <td className="px-4 py-2.5 text-right text-ink-2">{x.pct1.toFixed(0)}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Tarjeta>
        </Seccion>
      </div>
    </>
  )
}

function Kpi({ titulo, valor, pie }: { titulo: string; valor: string; pie: React.ReactNode }) {
  return (
    <Tarjeta className="grid gap-0.5 !p-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">{titulo}</p>
      <p className="num truncate font-display text-xl font-bold">{valor}</p>
      <p className="text-xs text-ink-3">{pie}</p>
    </Tarjeta>
  )
}
