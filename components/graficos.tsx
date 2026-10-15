'use client'

import { useState } from 'react'
import type { MetricaMes } from '@/lib/metricas'
import { MESES, MESES_CORTO } from '@/lib/reparto'
import { dinero } from '@/lib/cliente'

/** Escala "bonita" para el eje: 0, paso, 2·paso… cubriendo el máximo. */
function ticks(max: number): number[] {
  if (max <= 0) return [0]
  const bruto = max / 4
  const mag = 10 ** Math.floor(Math.log10(bruto))
  const paso = [1, 2, 2.5, 5, 10].map(f => f * mag).find(p => p >= bruto)!
  const out: number[] = []
  for (let v = 0; v <= max + paso * 0.001; v += paso) out.push(v)
  if (out[out.length - 1] < max) out.push(out[out.length - 1] + paso)
  return out
}

const corto = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : String(Math.round(n)))

export function LineaDeTiempo({ meses, moneda, nombres, mesFoco, promedio, onElegir }: {
  meses: MetricaMes[]; moneda: string; nombres: [string, string]; mesFoco: number; promedio: number; onElegir?: (m: number) => void
}) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 640, H = 240, L = 40, R = 8, T = 12, B = 26
  const ys = ticks(Math.max(...meses.map(m => m.total), 1))
  const max = ys[ys.length - 1]
  const y = (v: number) => T + (H - T - B) * (1 - v / max)
  const slot = (W - L - R) / 12
  const bw = Math.min(30, slot * 0.62)
  const activo = hover ?? null

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img"
        aria-label={`Gasto mensual por persona. Promedio ${dinero(promedio, moneda)}`} onMouseLeave={() => setHover(null)}>
        {ys.map(v => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="stroke-line" strokeWidth={1} />
            <text x={L - 6} y={y(v) + 4} textAnchor="end" className="fill-ink-3" fontSize={11}>{corto(v)}</text>
          </g>
        ))}
        {meses.map((m, i) => {
          const x = L + slot * i + (slot - bw) / 2
          const h1 = (H - T - B) * (m.persona1 / max)
          const h2 = (H - T - B) * (m.persona2 / max)
          const base = y(0)
          const gap = h1 > 0 && h2 > 0 ? 2 : 0
          const atenuado = activo != null && activo !== i
          return (
            <g key={m.mes} opacity={atenuado ? 0.45 : 1} style={{ transition: 'opacity .15s' }}>
              {h1 > 0 && <rect x={x} y={base - h1} width={bw} height={h1} rx={h2 > 0 ? 0 : 4} className="fill-p1" />}
              {h2 > 0 && <path d={barraRedondeada(x, base - h1 - gap - h2, bw, h2, 4)} className="fill-p2" />}
              <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize={11}
                className={m.mes === mesFoco ? 'fill-ink font-bold' : 'fill-ink-3'}>{MESES_CORTO[i]}</text>
              <rect x={L + slot * i} y={T} width={slot} height={H - T} fill="transparent"
                onMouseEnter={() => setHover(i)} onClick={() => { setHover(i); onElegir?.(m.mes) }} style={{ cursor: 'pointer' }} />
            </g>
          )
        })}
        {promedio > 0 && (
          <g pointerEvents="none">
            <line x1={L} x2={W - R} y1={y(promedio)} y2={y(promedio)} className="stroke-ink-2" strokeWidth={1.5} strokeDasharray="5 4" />
            <text x={W - R} y={y(promedio) - 5} textAnchor="end" fontSize={11} className="fill-ink-2 font-semibold">promedio</text>
          </g>
        )}
      </svg>
      {activo != null && meses[activo].total > 0 && (
        <div className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-xl bg-ink px-3 py-2 text-xs text-bg shadow-lg"
          style={{ left: `${((L + slot * activo + slot / 2) / W) * 100}%` }}>
          <p className="font-bold">{MESES[activo]} · {dinero(meses[activo].total, moneda)}</p>
          <p className="num"><span className="mr-1 inline-block h-2 w-2 rounded-full bg-p1" />{nombres[0]} {dinero(meses[activo].persona1, moneda)}</p>
          <p className="num"><span className="mr-1 inline-block h-2 w-2 rounded-full bg-p2" />{nombres[1]} {dinero(meses[activo].persona2, moneda)}</p>
        </div>
      )}
    </div>
  )
}

function barraRedondeada(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, h, w / 2)
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`
}

export function BarrasHorizontales({ filas, moneda }: { filas: { etiqueta: string; valor: number }[]; moneda: string }) {
  const max = Math.max(...filas.map(f => f.valor), 1)
  const total = filas.reduce((s, f) => s + f.valor, 0) || 1
  return (
    <div className="grid gap-2.5">
      {filas.map(f => (
        <div key={f.etiqueta} className="grid grid-cols-[minmax(84px,120px)_minmax(0,1fr)_auto] items-center gap-3 text-sm">
          <span className="truncate text-ink-2">{f.etiqueta}</span>
          <div className="h-3 overflow-hidden rounded bg-surface-2">
            <i className="block h-full rounded-r bg-accent" style={{ width: `${(f.valor / max) * 100}%` }} />
          </div>
          <span className="num text-right font-semibold">{dinero(f.valor, moneda)} <span className="text-xs font-normal text-ink-3">{((f.valor / total) * 100).toFixed(0)}%</span></span>
        </div>
      ))}
    </div>
  )
}
