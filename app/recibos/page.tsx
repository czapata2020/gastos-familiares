'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, XCircle, RefreshCw, Receipt, AlertCircle } from 'lucide-react'
import type { Recibo, MatchTipoRecibo } from '@/types'

function fmt(n: number | null) {
  if (n == null) return '—'
  return n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function BadgeEstado({ estado }: { estado: string }) {
  const cls = estado === 'pendiente'
    ? 'bg-amber-100 text-amber-700'
    : estado === 'confirmado'
    ? 'bg-green-100 text-green-700'
    : 'bg-red-100 text-red-600'
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{estado}</span>
}

function BadgeMatch({ tipo }: { tipo: MatchTipoRecibo | null }) {
  if (!tipo || tipo === 'ninguno') return <span className="text-xs text-gray-400">sin coincidencia</span>
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
      tipo === 'asignacion' ? 'bg-brand-100 text-brand-700' : 'bg-lavender/30 text-indigo-700'
    }`}>
      {tipo === 'asignacion' ? 'asignación' : 'gasto único'}
    </span>
  )
}

interface EditState {
  matchId: string
  matchTipo: MatchTipoRecibo
  monto: string
  asignadoA: string
}

function TarjetaRecibo({
  recibo,
  onConfirmar,
  onRechazar,
}: {
  recibo: Recibo
  onConfirmar: (id: string, overrides: Partial<EditState>) => Promise<void>
  onRechazar: (id: string) => Promise<void>
}) {
  const [editando, setEditando] = useState(false)
  const [busy, setBusy] = useState(false)
  const [edit, setEdit] = useState<EditState>({
    matchId:   recibo.matchId   ?? '',
    matchTipo: recibo.matchTipo ?? 'ninguno',
    monto:     recibo.monto?.toString() ?? '',
    asignadoA: recibo.asignadoA ?? 'ambos',
  })

  async function confirmar() {
    setBusy(true)
    await onConfirmar(recibo.id, {
      matchId:   edit.matchId   || undefined,
      matchTipo: edit.matchTipo || undefined,
      monto:     edit.monto ? parseFloat(edit.monto) as unknown as string : undefined,
      asignadoA: edit.asignadoA || undefined,
    })
    setBusy(false)
  }

  async function rechazar() {
    setBusy(true)
    await onRechazar(recibo.id)
    setBusy(false)
  }

  const isPendiente = recibo.estado === 'pendiente'

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex gap-0">
        {/* Imagen */}
        <div className="w-36 flex-shrink-0 bg-gray-50 flex items-center justify-center border-r border-gray-100">
          {recibo.imagenPath ? (
            <img
              src={`/api/recibos/${recibo.id}/imagen`}
              alt="Recibo"
              className="w-full h-full object-cover"
              style={{ maxHeight: 160 }}
            />
          ) : (
            <Receipt className="w-10 h-10 text-gray-200" />
          )}
        </div>

        {/* Contenido */}
        <div className="flex-1 p-4 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {recibo.tipoDetectado ?? 'Tipo desconocido'}
                </p>
                <BadgeEstado estado={recibo.estado} />
                {recibo.confianza != null && (
                  <span className="text-[10px] text-gray-400">
                    {(recibo.confianza * 100).toFixed(0)}% confianza
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {recibo.remitente ?? 'Remitente desconocido'} · {recibo.fecha ?? '—'}
              </p>
            </div>
            <p className="text-lg font-bold text-gray-900 flex-shrink-0">
              {fmt(recibo.monto)}
            </p>
          </div>

          {/* Match info */}
          <div className="flex items-center gap-2 mb-3 text-xs text-gray-500">
            <span>Coincide con:</span>
            <BadgeMatch tipo={recibo.matchTipo} />
            {recibo.matchId && <span className="font-mono text-gray-400">{recibo.matchId}</span>}
          </div>

          {/* Editor de overrides */}
          {isPendiente && editando && (
            <div className="grid grid-cols-2 gap-2 mb-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">Tipo de match</label>
                <select
                  value={edit.matchTipo}
                  onChange={e => setEdit(s => ({ ...s, matchTipo: e.target.value as MatchTipoRecibo }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="asignacion">asignación</option>
                  <option value="gasto_unico">gasto único</option>
                  <option value="ninguno">ninguno</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">ID del match</label>
                <input
                  type="text"
                  value={edit.matchId}
                  onChange={e => setEdit(s => ({ ...s, matchId: e.target.value }))}
                  placeholder="ID de asignacion/uso"
                  className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">Monto</label>
                <input
                  type="number"
                  step="0.01"
                  value={edit.monto}
                  onChange={e => setEdit(s => ({ ...s, monto: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">Asignado a</label>
                <select
                  value={edit.asignadoA}
                  onChange={e => setEdit(s => ({ ...s, asignadoA: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="ambos">Ambos</option>
                  <option value="1">Persona 1</option>
                  <option value="2">Persona 2</option>
                </select>
              </div>
            </div>
          )}

          {/* Acciones */}
          {isPendiente && (
            <div className="flex items-center gap-2">
              <button
                onClick={confirmar}
                disabled={busy}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 text-white text-xs font-medium rounded-lg hover:bg-brand-600 disabled:opacity-50 transition-colors"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Confirmar
              </button>
              <button
                onClick={rechazar}
                disabled={busy}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                <XCircle className="w-3.5 h-3.5" />
                Rechazar
              </button>
              <button
                onClick={() => setEditando(e => !e)}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                {editando ? 'ocultar correcciones' : 'corregir datos'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function RecibosPage() {
  const [recibos, setRecibos] = useState<Recibo[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro] = useState<'pendiente' | 'confirmado' | 'rechazado' | 'todos'>('pendiente')

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const url = filtro === 'todos' ? '/api/recibos' : `/api/recibos?estado=${filtro}`
      const res = await fetch(url)
      if (res.ok) setRecibos(await res.json())
    } finally {
      setCargando(false)
    }
  }, [filtro])

  useEffect(() => { cargar() }, [cargar])

  async function handleConfirmar(id: string, overrides: Record<string, unknown>) {
    await fetch(`/api/recibos/${id}/confirmar`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(overrides),
    })
    cargar()
  }

  async function handleRechazar(id: string) {
    await fetch(`/api/recibos/${id}/rechazar`, { method: 'PATCH' })
    cargar()
  }

  const pendientes = recibos.filter(r => r.estado === 'pendiente').length

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Recibos de WhatsApp</h1>
          <p className="text-sm text-gray-500">Revisión de recibos detectados automáticamente</p>
        </div>
        <button
          onClick={cargar}
          disabled={cargando}
          className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-1 mb-5">
        {(['pendiente', 'confirmado', 'rechazado', 'todos'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filtro === f
                ? 'bg-brand-500 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {f === 'todos' ? 'Todos' : f.charAt(0).toUpperCase() + f.slice(1)}
            {f === 'pendiente' && pendientes > 0 && (
              <span className="ml-1.5 bg-amber-400 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {pendientes}
              </span>
            )}
          </button>
        ))}
      </div>

      {cargando ? (
        <div className="flex items-center justify-center py-24 text-gray-400 text-sm">Cargando…</div>
      ) : recibos.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <AlertCircle className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-600">
            {filtro === 'pendiente' ? 'Sin recibos pendientes de revisión' : 'Sin recibos en este estado'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Los recibos aparecen aquí cuando alguien sube una foto al grupo de WhatsApp
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {recibos.map(r => (
            <TarjetaRecibo
              key={r.id}
              recibo={r}
              onConfirmar={handleConfirmar}
              onRechazar={handleRechazar}
            />
          ))}
        </div>
      )}
    </div>
  )
}
