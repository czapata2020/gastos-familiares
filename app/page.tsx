'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Configuracion, Servicio, AsignacionMes, GastoUnico, UsoGastoUnico } from '@/types'
import { calcularPorcentajes } from '@/types'

// ── Constants ─────────────────────────────────────────────────────────────────

const CAT_EMOJI: Record<string, string> = {
  electricidad: '⚡', agua: '💧', gas: '🔥', internet: '📡',
  telefono: '📱', streaming: '📺', hipoteca: '🏠', asistente_hogar: '🧹',
  vigilancia: '🔒', nana: '👶', seguridad_vecinal: '🛡️',
  alimentos: '🛒', seguro_vehicular: '🚗', kinder: '🎒', otro: '📦',
}

const MESES_NOMBRE = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

const DEFAULT_CONFIG: Configuracion = {
  persona1: { nombre: 'Persona 1', salario: 0, moneda: 'PEN' },
  persona2: { nombre: 'Persona 2', salario: 0, moneda: 'USD' },
  moneda: 'PEN', tipoCambio: 1,
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Fila {
  servicio: Servicio
  asignacionId: string | null
  monto: string
  asignadoA: '1' | '2' | 'ambos'
  pagado: boolean
  esCuotaDoble: boolean
}

interface FilaUnico {
  rowKey: string
  id: string | null
  gastoUnicoId: string
  gastoNombre: string
  gastoCate: string
  monto: string
  asignadoA: '1' | '2' | 'ambos'
  pagado: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function esMesActivo(s: Servicio, mes: number): boolean {
  if (!s.activo) return false
  if (s.periodicidad !== 'personalizado') return true
  if (s.mesInicio && s.mesFin) return mes >= s.mesInicio && mes <= s.mesFin
  return true
}

function fmt(n: number, moneda: string) {
  return `${moneda} ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ── Sub-components (defined outside to avoid remount on re-render) ─────────────

interface FilaRowProps {
  f: Fila
  moneda: string
  n1: string
  n2: string
  openHelper: string | null
  copied: string | null
  onToggleHelper: (id: string) => void
  onCopy: (id: string, text: string) => void
  onUpdate: (servicioId: string, patch: Partial<Omit<Fila, 'servicio'>>) => void
}

function FilaRow({ f, moneda, n1, n2, openHelper, copied, onToggleHelper, onCopy, onUpdate }: FilaRowProps) {
  const emoji = CAT_EMOJI[f.servicio.categoria] ?? '📦'
  const tieneComentario = !!f.servicio.comentario
  const helperAbierto   = openHelper === f.servicio.id

  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50/40 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg leading-none">{emoji}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium text-gray-900">{f.servicio.nombre}</p>
              {tieneComentario && (
                <div className="relative flex-shrink-0">
                  <button
                    type="button"
                    onClick={e => { e.preventDefault(); e.stopPropagation(); onToggleHelper(f.servicio.id) }}
                    title="Ver referencia"
                    className={`w-5 h-5 rounded-full text-[10px] font-bold transition-colors flex items-center justify-center ${
                      helperAbierto
                        ? 'bg-brand-600 text-white'
                        : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                    }`}>
                    ?
                  </button>
                  {helperAbierto && (
                    <div className="absolute z-20 top-7 left-0 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-64">
                      <p className="text-xs font-medium text-gray-500 mb-1">Referencia</p>
                      <p className="text-sm text-gray-800 break-words mb-2">{f.servicio.comentario}</p>
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); onCopy(f.servicio.id, f.servicio.comentario) }}
                        title="Copiar al portapapeles"
                        className="flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 transition-colors">
                        {copied === f.servicio.id ? (
                          <span className="text-green-600">✓ Copiado</span>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
                              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                            </svg>
                            Copiar
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            {f.servicio.diaVencimiento && (
              <p className="text-xs text-gray-400">Vence día {f.servicio.diaVencimiento}</p>
            )}
          </div>
        </div>
      </td>

      <td className="px-4 py-3 w-44">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400 flex-shrink-0">{moneda}</span>
          {f.esCuotaDoble && (
            <span title="Mes de cuota doble"
              className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-bold flex-shrink-0 leading-tight">
              ×2
            </span>
          )}
          <input
            type="text"
            inputMode="decimal"
            value={f.monto}
            placeholder={f.servicio.tipoGasto === 'fijo'
              ? (f.servicio.montoFijo?.toString() ?? '0.00')
              : '0.00'}
            onChange={e => onUpdate(f.servicio.id, { monto: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </td>

      <td className="px-4 py-3 w-40">
        <select
          value={f.asignadoA}
          onChange={e => onUpdate(f.servicio.id, { asignadoA: e.target.value as '1' | '2' | 'ambos' })}
          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
          <option value="ambos">Ambos</option>
          <option value="1">{n1}</option>
          <option value="2">{n2}</option>
        </select>
      </td>

      <td className="px-4 py-3 w-20 text-center">
        <button
          type="button"
          onClick={() => onUpdate(f.servicio.id, { pagado: !f.pagado })}
          title={f.pagado ? 'Marcar como pendiente' : 'Marcar como pagado'}
          className={`w-7 h-7 rounded-full text-xs font-bold transition-all border ${
            f.pagado
              ? 'bg-green-500 border-green-500 text-white shadow-sm'
              : 'bg-white border-gray-300 text-gray-300 hover:border-green-400 hover:text-green-400'
          }`}>
          ✓
        </button>
      </td>
    </tr>
  )
}

function SectionHeader({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <tr>
      <td colSpan={4} className={`px-4 py-2.5 ${color}`}>
        <span className="text-sm font-semibold">{label}</span>
        <span className="ml-2 text-xs opacity-70">({count})</span>
      </td>
    </tr>
  )
}

function EmptyRow({ msg }: { msg: string }) {
  return (
    <tr>
      <td colSpan={4} className="px-4 py-5 text-center text-sm text-gray-400">{msg}</td>
    </tr>
  )
}

interface FilaUnicoRowProps {
  f: FilaUnico
  moneda: string
  n1: string
  n2: string
  onUpdate: (rowKey: string, patch: Partial<Omit<FilaUnico, 'rowKey'>>) => void
  onDelete: (f: FilaUnico) => void
}

function FilaUnicoRow({ f, moneda, n1, n2, onUpdate, onDelete }: FilaUnicoRowProps) {
  const emoji = CAT_EMOJI[f.gastoCate] ?? '📦'
  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50/40 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg leading-none">{emoji}</span>
          <p className="text-sm font-medium text-gray-900">{f.gastoNombre}</p>
        </div>
      </td>
      <td className="px-4 py-3 w-44">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400 flex-shrink-0">{moneda}</span>
          <input
            type="text"
            inputMode="decimal"
            value={f.monto}
            placeholder="0.00"
            onChange={e => onUpdate(f.rowKey, { monto: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </td>
      <td className="px-4 py-3 w-40">
        <select
          value={f.asignadoA}
          onChange={e => onUpdate(f.rowKey, { asignadoA: e.target.value as '1' | '2' | 'ambos' })}
          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
          <option value="ambos">Ambos</option>
          <option value="1">{n1}</option>
          <option value="2">{n2}</option>
        </select>
      </td>
      <td className="px-4 py-3 w-20 text-center">
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => onUpdate(f.rowKey, { pagado: !f.pagado })}
            className={`w-7 h-7 rounded-full text-xs font-bold transition-all border ${
              f.pagado
                ? 'bg-green-500 border-green-500 text-white shadow-sm'
                : 'bg-white border-gray-300 text-gray-300 hover:border-green-400 hover:text-green-400'
            }`}>
            ✓
          </button>
          <button
            type="button"
            onClick={() => onDelete(f)}
            title="Quitar gasto"
            className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none">
            ×
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const now = new Date()
  const [mes, setMes]   = useState(now.getMonth() + 1)
  const [anio, setAnio] = useState(now.getFullYear())

  const [config, setConfig] = useState<Configuracion>(DEFAULT_CONFIG)
  const [filas, setFilas]   = useState<Fila[]>([])
  const [cargando, setCargando]   = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [dirty, setDirty]   = useState(false)
  const [saved, setSaved]   = useState(false)
  const [openHelper, setOpenHelper] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [usos, setUsos] = useState<FilaUnico[]>([])
  const [biblioteca, setBiblioteca] = useState<GastoUnico[]>([])
  const [pickerAbierto, setPickerAbierto] = useState(false)

  const cargarDatos = useCallback(async () => {
    setCargando(true)
    try {
      const [cfgRes, srvRes, asigRes, usosRes, biblioRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/servicios'),
        fetch(`/api/asignaciones?mes=${mes}&anio=${anio}`),
        fetch(`/api/usos-gasto-unico?mes=${mes}&anio=${anio}`),
        fetch('/api/gastos-unicos'),
      ])

      const cfg: Configuracion     = cfgRes.ok    ? await cfgRes.json()    : DEFAULT_CONFIG
      const srvAll: Servicio[]     = srvRes.ok    ? await srvRes.json()    : []
      const asigs: AsignacionMes[] = asigRes.ok   ? await asigRes.json()   : []
      const usosDB: UsoGastoUnico[]= usosRes.ok   ? await usosRes.json()   : []
      const biblio: GastoUnico[]   = biblioRes.ok ? await biblioRes.json() : []

      setConfig(cfg)
      setBiblioteca(biblio)
      setFilas(srvAll.filter(s => esMesActivo(s, mes)).map(s => {
        const a = asigs.find(x => x.servicioId === s.id)
        const esCuotaDoble = s.cuotaDoble && s.mesesCuotaDoble.includes(mes)
        const montoDefault = s.tipoGasto === 'fijo' && s.montoFijo != null
          ? (esCuotaDoble ? s.montoFijo * 2 : s.montoFijo).toString()
          : ''
        const montoFinal = (() => {
          if (!a) return montoDefault
          if (esCuotaDoble && s.tipoGasto === 'fijo' && s.montoFijo != null
              && Math.abs(a.monto - s.montoFijo) < 0.01) {
            return (s.montoFijo * 2).toString()
          }
          return a.monto.toString()
        })()

        return {
          servicio: s,
          asignacionId: a?.id ?? null,
          monto: montoFinal,
          asignadoA: (a?.asignadoA as '1' | '2' | 'ambos') ?? 'ambos',
          pagado: a?.pagado ?? false,
          esCuotaDoble,
        }
      }))
      setUsos(usosDB.map(u => ({
        rowKey: u.id,
        id: u.id,
        gastoUnicoId: u.gastoUnicoId,
        gastoNombre: u.gastoNombre,
        gastoCate: u.gastoCate,
        monto: u.monto.toString(),
        asignadoA: u.asignadoA as '1' | '2' | 'ambos',
        pagado: u.pagado,
      })))
      setDirty(false)
    } finally {
      setCargando(false)
    }
  }, [mes, anio])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  const handleUpdate = useCallback((servicioId: string, patch: Partial<Omit<Fila, 'servicio'>>) => {
    setFilas(prev => prev.map(f => f.servicio.id === servicioId ? { ...f, ...patch } : f))
    setDirty(true)
    setSaved(false)
  }, [])

  const handleToggleHelper = useCallback((id: string) => {
    setOpenHelper(prev => prev === id ? null : id)
  }, [])

  const handleCopy = useCallback((id: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id)
      setTimeout(() => setCopied(c => c === id ? null : c), 2000)
    })
  }, [])

  const handleUpdateUso = useCallback((rowKey: string, patch: Partial<Omit<FilaUnico, 'rowKey'>>) => {
    setUsos(prev => prev.map(f => f.rowKey === rowKey ? { ...f, ...patch } : f))
    setDirty(true)
    setSaved(false)
  }, [])

  const handleDeleteUso = useCallback(async (f: FilaUnico) => {
    if (f.id) {
      await fetch(`/api/usos-gasto-unico/${f.id}`, { method: 'DELETE' })
    }
    setUsos(prev => prev.filter(u => u.rowKey !== f.rowKey))
    setDirty(true)
    setSaved(false)
  }, [])

  const handleAgregarUso = useCallback((g: GastoUnico) => {
    const newUso: FilaUnico = {
      rowKey: `new-${Date.now()}-${Math.random()}`,
      id: null,
      gastoUnicoId: g.id,
      gastoNombre: g.nombre,
      gastoCate: g.categoria,
      monto: g.montoRef?.toString() ?? '',
      asignadoA: 'ambos',
      pagado: false,
    }
    setUsos(prev => [...prev, newUso])
    setPickerAbierto(false)
    setDirty(true)
    setSaved(false)
  }, [])

  async function guardar() {
    setGuardando(true)
    try {
      await Promise.all([
        ...filas.map(async (f) => {
          const monto = parseFloat(f.monto.replace(',', '.'))
          if (!f.monto.trim() || isNaN(monto) || monto <= 0) return
          const body = {
            mes, año: anio,
            servicioId: f.servicio.id, servicioNombre: f.servicio.nombre,
            monto, asignadoA: f.asignadoA, pagado: f.pagado,
            ...(f.pagado ? { fechaPago: new Date().toISOString().slice(0, 10) } : { fechaPago: null }),
          }
          if (f.asignacionId) {
            await fetch(`/api/asignaciones/${f.asignacionId}`, {
              method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
            })
          } else {
            await fetch('/api/asignaciones', {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
            })
          }
        }),
        ...usos.map(async (f) => {
          const monto = parseFloat(f.monto.replace(',', '.'))
          if (!f.monto.trim() || isNaN(monto) || monto <= 0) return
          const body = {
            gastoUnicoId: f.gastoUnicoId, gastoNombre: f.gastoNombre, gastoCate: f.gastoCate,
            mes, año: anio, monto, asignadoA: f.asignadoA, pagado: f.pagado,
            ...(f.pagado ? { fechaPago: new Date().toISOString().slice(0, 10) } : { fechaPago: null }),
          }
          if (f.id) {
            await fetch(`/api/usos-gasto-unico/${f.id}`, {
              method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
            })
          } else {
            await fetch('/api/usos-gasto-unico', {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
            })
          }
        }),
      ])
      await cargarDatos()
      setSaved(true)
    } finally {
      setGuardando(false)
    }
  }

  // ── Totales ────────────────────────────────────────────────────────────────
  const { porcentaje1, porcentaje2 } = calcularPorcentajes(config)
  let total1 = 0, total2 = 0
  for (const f of [...filas, ...usos]) {
    const m = parseFloat(f.monto.replace(',', '.')) || 0
    if      (f.asignadoA === '1')    { total1 += m }
    else if (f.asignadoA === '2')    { total2 += m }
    else { total1 += m * porcentaje1 / 100; total2 += m * porcentaje2 / 100 }
  }
  const totalGeneral = total1 + total2
  const totalPagados = filas.filter(f => f.pagado).length + usos.filter(f => f.pagado).length
  const totalItems   = filas.length + usos.length

  const fijas     = filas.filter(f => f.servicio.tipoGasto === 'fijo')
  const variables = filas.filter(f => f.servicio.tipoGasto === 'variable')

  const n1 = config.persona1.nombre || 'Persona 1'
  const n2 = config.persona2.nombre || 'Persona 2'

  const yearOpts = [anio - 1, anio, anio + 1]
  const selCls   = 'border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'

  const rowProps = { moneda: config.moneda, n1, n2, openHelper, copied, onToggleHelper: handleToggleHelper, onCopy: handleCopy, onUpdate: handleUpdate }

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Resumen del mes</h1>
          <p className="text-sm text-gray-500">Gastos compartidos del hogar</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={mes}  onChange={e => { setMes(Number(e.target.value));  setSaved(false) }} className={selCls}>
            {MESES_NOMBRE.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={anio} onChange={e => { setAnio(Number(e.target.value)); setSaved(false) }} className={selCls}>
            {yearOpts.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {cargando ? (
        <div className="flex items-center justify-center py-24 text-gray-400 text-sm">Cargando…</div>
      ) : (
        <>
          {/* ── Tarjetas resumen ───────────────────────────────── */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-brand-50 border border-brand-200 rounded-xl p-4">
              <p className="text-xs font-medium text-brand-600 mb-1">{n1}</p>
              <p className="text-2xl font-bold text-brand-800">{fmt(total1, config.moneda)}</p>
              <p className="text-xs text-brand-500 mt-1">{porcentaje1.toFixed(1)}% del total</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-xs font-medium text-blue-600 mb-1">{n2}</p>
              <p className="text-2xl font-bold text-blue-800">{fmt(total2, config.moneda)}</p>
              <p className="text-xs text-blue-500 mt-1">{porcentaje2.toFixed(1)}% del total</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <p className="text-xs font-medium text-gray-500 mb-1">Total del mes</p>
              <p className="text-2xl font-bold text-gray-900">{fmt(totalGeneral, config.moneda)}</p>
              <p className="text-xs text-gray-400 mt-1">
                {totalPagados}/{totalItems} pagados
              </p>
            </div>
          </div>

          {/* ── Tabla de gastos ────────────────────────────────── */}
          {filas.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-sm text-amber-800 text-center">
              <p className="font-semibold mb-1">Sin servicios para {MESES_NOMBRE[mes - 1]} {anio}</p>
              <a href="/configuracion" className="underline font-medium">Agregar servicios en Configuración →</a>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Servicio</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 w-44">Monto</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 w-40">¿Quién paga?</th>
                    <th className="px-4 py-2.5 text-center text-xs font-medium text-gray-500 w-20">Pagado</th>
                  </tr>
                </thead>
                <tbody>
                  <SectionHeader label="📌 Gastos Fijos"     count={fijas.length}     color="bg-green-50 text-green-800 border-b border-green-100" />
                  {fijas.length === 0
                    ? <EmptyRow msg="Sin gastos fijos para este mes" />
                    : fijas.map(f => <FilaRow key={f.servicio.id} f={f} {...rowProps} />)
                  }
                  <SectionHeader label="📋 Gastos Variables" count={variables.length}  color="bg-amber-50 text-amber-800 border-t border-b border-amber-100" />
                  {variables.length === 0
                    ? <EmptyRow msg="Sin gastos variables para este mes" />
                    : variables.map(f => <FilaRow key={f.servicio.id} f={f} {...rowProps} />)
                  }

                  {/* Fila total */}
                  <tr className="border-t-2 border-gray-200 bg-gray-50">
                    <td className="px-4 py-3 text-sm font-semibold text-gray-700">Total</td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">{fmt(totalGeneral, config.moneda)}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {n1}: {fmt(total1, config.moneda)}<br />
                      {n2}: {fmt(total2, config.moneda)}
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-400">
                      {filas.filter(f => f.pagado).length}/{filas.length}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* ── Gastos Únicos ──────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-purple-50">
              <span className="text-sm font-semibold text-purple-800">💰 Gastos Únicos</span>
              <button
                type="button"
                onClick={() => setPickerAbierto(p => !p)}
                className="px-3 py-1 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 transition-colors">
                + Agregar
              </button>
            </div>

            {/* Picker de biblioteca */}
            {pickerAbierto && (
              <div className="px-4 py-3 border-b border-gray-100 bg-purple-50/40">
                {biblioteca.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-2">
                    Sin plantillas aún.{' '}
                    <a href="/configuracion" className="text-brand-600 underline">Agregar en Configuración →</a>
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {biblioteca.map(g => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => handleAgregarUso(g)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-purple-300 rounded-lg text-xs font-medium text-purple-700 hover:bg-purple-50 hover:border-purple-500 transition-colors">
                        {CAT_EMOJI[g.categoria] ?? '📦'} {g.nombre}
                        {g.montoRef != null && <span className="text-gray-400">{config.moneda} {g.montoRef}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <table className="w-full">
              <tbody>
                {usos.length === 0 && !pickerAbierto ? (
                  <EmptyRow msg="Sin gastos únicos para este mes — usa el botón + Agregar" />
                ) : (
                  usos.map(f => (
                    <FilaUnicoRow
                      key={f.rowKey}
                      f={f}
                      moneda={config.moneda}
                      n1={n1}
                      n2={n2}
                      onUpdate={handleUpdateUso}
                      onDelete={handleDeleteUso}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* ── Barra de guardado ──────────────────────────────── */}
          {(filas.length > 0 || usos.length > 0) && (
            <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-5 py-3">
              <div className="text-sm">
                {dirty && !guardando && <span className="text-amber-600 font-medium">● Hay cambios sin guardar</span>}
                {!dirty && saved       && <span className="text-green-600 font-medium">✓ Guardado correctamente</span>}
                {!dirty && !saved      && <span className="text-gray-400">Sin cambios pendientes</span>}
              </div>
              <button onClick={guardar} disabled={guardando || !dirty}
                className="px-5 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-40 transition-colors">
                {guardando ? 'Guardando…' : 'Guardar mes'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
