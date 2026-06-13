'use client'

import { useState, useEffect } from 'react'
import type { Configuracion, Servicio, CategoriaServicio, GastoUnico } from '@/types'

type Tab = 'general' | 'servicios' | 'unicos'

interface FormServicio {
  nombre: string
  categoria: CategoriaServicio
  tipoGasto: 'fijo' | 'variable'
  montoFijo: string
  periodicidad: 'mensual' | 'anual' | 'personalizado'
  mesInicio: string
  mesFin: string
  diaVencimiento: string
  comentario: string
  cuotaDoble: boolean
  mesesCuotaDoble: number[]
}

const FORM_INICIAL: FormServicio = {
  nombre: '', categoria: 'electricidad', tipoGasto: 'variable',
  montoFijo: '', periodicidad: 'mensual', mesInicio: '', mesFin: '', diaVencimiento: '',
  comentario: '', cuotaDoble: false, mesesCuotaDoble: [],
}

const CATEGORIAS: { value: CategoriaServicio; label: string; emoji: string }[] = [
  { value: 'electricidad',     label: 'Luz',                   emoji: '⚡' },
  { value: 'agua',             label: 'Agua',                  emoji: '💧' },
  { value: 'gas',              label: 'Gas',                   emoji: '🔥' },
  { value: 'internet',         label: 'Internet',              emoji: '📡' },
  { value: 'hipoteca',         label: 'Hipoteca',              emoji: '🏠' },
  { value: 'asistente_hogar',  label: 'Asistente del Hogar',   emoji: '🧹' },
  { value: 'vigilancia',       label: 'Vigilancia del Hogar',  emoji: '🔒' },
  { value: 'nana',             label: 'Nana',                  emoji: '👶' },
  { value: 'seguridad_vecinal',label: 'Seguridad Vecinal',     emoji: '🛡️' },
  { value: 'alimentos',        label: 'Alimentos',             emoji: '🛒' },
  { value: 'seguro_vehicular', label: 'Seguro Vehicular',      emoji: '🚗' },
  { value: 'kinder',           label: 'Kinder Garden',         emoji: '🎒' },
  { value: 'telefono',         label: 'Teléfono',              emoji: '📱' },
  { value: 'streaming',        label: 'Streaming',             emoji: '📺' },
  { value: 'otro',             label: 'Otro',                  emoji: '📦' },
]

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const MONEDAS = [
  { value: 'PEN', label: 'PEN – Sol peruano' },
  { value: 'COP', label: 'COP – Peso colombiano' },
  { value: 'MXN', label: 'MXN – Peso mexicano' },
  { value: 'USD', label: 'USD – Dólar' },
  { value: 'EUR', label: 'EUR – Euro' },
  { value: 'CLP', label: 'CLP – Peso chileno' },
  { value: 'ARS', label: 'ARS – Peso argentino' },
]

function HelperBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 leading-relaxed space-y-1">
      {children}
    </div>
  )
}

function BtnHelper({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-[10px] font-bold hover:bg-gray-300 flex items-center justify-center flex-shrink-0">
      ?
    </button>
  )
}

export default function ConfiguracionPage() {
  const [tab, setTab] = useState<Tab>('general')

  // ── Config ────────────────────────────────────────────────────
  const [config, setConfig] = useState<Configuracion>({
    persona1: { nombre: '', salario: 0, moneda: 'PEN', email: '', notificaciones: true },
    persona2: { nombre: '', salario: 0, moneda: 'USD', email: '', notificaciones: true },
    moneda: 'PEN', tipoCambio: 1,
  })
  const [cargandoConfig, setCargandoConfig] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [guardadoOk, setGuardadoOk] = useState(false)
  const [errorGuardado, setErrorGuardado] = useState('')
  const [probandoEmail, setProbandoEmail] = useState(false)
  const [resultadoEmail, setResultadoEmail] = useState('')

  // ── Servicios ─────────────────────────────────────────────────
  const [servicios, setServicios]         = useState<Servicio[]>([])
  const [cargandoServs, setCargandoServs] = useState(false)

  // ── Gastos Únicos ─────────────────────────────────────────────
  const [unicos, setUnicos]                   = useState<GastoUnico[]>([])
  const [cargandoUnicos, setCargandoUnicos]   = useState(false)
  const [mostrandoFormUnico, setMostrandoFormUnico] = useState(false)
  const [editandoUnicoId, setEditandoUnicoId] = useState<string | null>(null)
  const [guardandoUnico, setGuardandoUnico]   = useState(false)
  const [formUnico, setFormUnico] = useState({ nombre: '', categoria: 'otro' as CategoriaServicio, montoRef: '', comentario: '' })
  const [mostrandoForm, setMostrandoForm] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [guardandoServ, setGuardandoServ] = useState(false)
  const [form, setForm] = useState<FormServicio>(FORM_INICIAL)
  const [helper, setHelper] = useState<'tipoGasto' | 'periodicidad' | 'cuotaDoble' | null>(null)

  // ── Efectos ───────────────────────────────────────────────────
  useEffect(() => { cargarConfig() }, [])
  useEffect(() => {
    if (tab === 'servicios') cargarServicios()
    if (tab === 'unicos')    cargarUnicos()
  }, [tab])

  // ── Config ────────────────────────────────────────────────────
  async function cargarConfig() {
    setCargandoConfig(true)
    try {
      const res = await fetch('/api/settings')
      if (res.ok) setConfig(await res.json())
    } finally { setCargandoConfig(false) }
  }

  async function guardarConfig(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setGuardadoOk(false)
    setErrorGuardado('')
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (res.ok) setGuardadoOk(true)
      else setErrorGuardado('Error al guardar. Intenta de nuevo.')
    } catch {
      setErrorGuardado('No se pudo conectar con el servidor.')
    } finally { setGuardando(false) }
  }

  async function probarNotificacion() {
    setProbandoEmail(true)
    setResultadoEmail('')
    try {
      const res = await fetch('/api/notificaciones/test', { method: 'POST' })
      const json = await res.json()
      setResultadoEmail(res.ok ? `✓ ${json.mensaje}` : `✗ ${json.error}`)
    } catch {
      setResultadoEmail('✗ No se pudo conectar con el servidor')
    } finally { setProbandoEmail(false) }
  }

  // ── Servicios ─────────────────────────────────────────────────
  async function cargarServicios() {
    setCargandoServs(true)
    try {
      const res = await fetch('/api/servicios')
      if (res.ok) setServicios(await res.json())
    } finally { setCargandoServs(false) }
  }

  function abrirEditar(s: Servicio) {
    setForm({
      nombre: s.nombre, categoria: s.categoria, tipoGasto: s.tipoGasto,
      montoFijo: s.montoFijo?.toString() ?? '',
      periodicidad: s.periodicidad,
      mesInicio: s.mesInicio?.toString() ?? '',
      mesFin: s.mesFin?.toString() ?? '',
      diaVencimiento: s.diaVencimiento?.toString() ?? '',
      comentario: s.comentario ?? '',
      cuotaDoble: s.cuotaDoble ?? false,
      mesesCuotaDoble: s.mesesCuotaDoble ?? [],
    })
    setEditandoId(s.id)
    setHelper(null)
    setMostrandoForm(true)
  }

  function cancelarForm() {
    setMostrandoForm(false)
    setEditandoId(null)
    setForm(FORM_INICIAL)
    setHelper(null)
  }

  async function guardarServicio(e: React.FormEvent) {
    e.preventDefault()
    setGuardandoServ(true)
    const payload = {
      nombre: form.nombre, categoria: form.categoria, tipoGasto: form.tipoGasto,
      montoFijo: form.tipoGasto === 'fijo' ? parseFloat(form.montoFijo) || null : null,
      periodicidad: form.periodicidad,
      mesInicio: form.periodicidad === 'personalizado' ? parseInt(form.mesInicio) || null : null,
      mesFin:    form.periodicidad === 'personalizado' ? parseInt(form.mesFin)    || null : null,
      diaVencimiento: parseInt(form.diaVencimiento) || null,
      comentario: form.comentario.slice(0, 100),
      cuotaDoble: form.cuotaDoble,
      mesesCuotaDoble: form.cuotaDoble ? form.mesesCuotaDoble : [],
    }
    try {
      if (editandoId) {
        await fetch(`/api/servicios/${editandoId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
      } else {
        await fetch('/api/servicios', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
      }
      cancelarForm()
      cargarServicios()
    } finally { setGuardandoServ(false) }
  }

  async function eliminarServicio(id: string) {
    await fetch(`/api/servicios/${id}`, { method: 'DELETE' })
    cargarServicios()
  }

  // ── Gastos Únicos ─────────────────────────────────────────────
  async function cargarUnicos() {
    setCargandoUnicos(true)
    try {
      const res = await fetch('/api/gastos-unicos')
      if (res.ok) setUnicos(await res.json())
    } finally { setCargandoUnicos(false) }
  }

  function abrirEditarUnico(g: GastoUnico) {
    setFormUnico({ nombre: g.nombre, categoria: g.categoria, montoRef: g.montoRef?.toString() ?? '', comentario: g.comentario })
    setEditandoUnicoId(g.id)
    setMostrandoFormUnico(true)
  }

  function cancelarFormUnico() {
    setMostrandoFormUnico(false)
    setEditandoUnicoId(null)
    setFormUnico({ nombre: '', categoria: 'otro', montoRef: '', comentario: '' })
  }

  async function guardarUnico(e: React.FormEvent) {
    e.preventDefault()
    setGuardandoUnico(true)
    const payload = {
      nombre: formUnico.nombre,
      categoria: formUnico.categoria,
      montoRef: parseFloat(formUnico.montoRef) || null,
      comentario: formUnico.comentario.slice(0, 100),
    }
    try {
      if (editandoUnicoId) {
        await fetch(`/api/gastos-unicos/${editandoUnicoId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
      } else {
        await fetch('/api/gastos-unicos', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
      }
      cancelarFormUnico()
      cargarUnicos()
    } finally { setGuardandoUnico(false) }
  }

  async function eliminarUnico(id: string) {
    await fetch(`/api/gastos-unicos/${id}`, { method: 'DELETE' })
    cargarUnicos()
  }

  // ── Cálculos ──────────────────────────────────────────────────
  const monedasDiferentes = config.persona1.moneda !== config.persona2.moneda
  const monedaExtranjera  = monedasDiferentes
    ? (config.persona2.moneda !== config.moneda ? config.persona2.moneda : config.persona1.moneda)
    : null

  const toBase   = (s: number, m: string) => m === config.moneda ? s : s * config.tipoCambio
  const s1       = toBase(config.persona1.salario, config.persona1.moneda)
  const s2       = toBase(config.persona2.salario, config.persona2.moneda)
  const totalBase = s1 + s2
  const pct1 = totalBase > 0 ? ((s1 / totalBase) * 100).toFixed(1) : '0'
  const pct2 = totalBase > 0 ? ((s2 / totalBase) * 100).toFixed(1) : '0'

  const catInfo = (cat: CategoriaServicio) => CATEGORIAS.find(c => c.value === cat) ?? CATEGORIAS[6]
  const labelPer = (s: Servicio) => {
    if (s.periodicidad === 'mensual') return 'Mensual'
    if (s.periodicidad === 'anual')   return 'Anual'
    if (s.mesInicio && s.mesFin) return `${MESES[s.mesInicio - 1]} – ${MESES[s.mesFin - 1]}`
    return 'Personalizado'
  }

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Configuración</h1>
      <p className="text-gray-500 mb-6">Gestiona los datos del hogar y los servicios compartidos</p>

      {/* ── Tabs ──────────────────────────────────────────────── */}
      <div className="flex border-b border-gray-200 mb-6">
        {([
          { id: 'general',   label: '⚙ General' },
          { id: 'servicios', label: '🔌 Servicios' },
          { id: 'unicos',    label: '💰 Únicos' },
        ] as { id: Tab; label: string }[]).map(({ id, label }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === id
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ════ TAB GENERAL ════════════════════════════════════════ */}
      {tab === 'general' && (
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Personas y salarios</h2>

          {cargandoConfig ? (
            <p className="text-sm text-gray-400">Cargando configuración…</p>
          ) : (
            <form onSubmit={guardarConfig} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                {/* Persona 1 */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-700">Persona 1</h3>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Nombre</label>
                    <input type="text" value={config.persona1.nombre} placeholder="Tu nombre"
                      onChange={e => setConfig({ ...config, persona1: { ...config.persona1, nombre: e.target.value } })}
                      className={inputCls} />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-gray-500">Correo electrónico</label>
                      <label className="flex items-center gap-1.5 cursor-pointer select-none">
                        <span className="text-xs text-gray-400">Notificaciones</span>
                        <button
                          type="button"
                          onClick={() => setConfig({ ...config, persona1: { ...config.persona1, notificaciones: !config.persona1.notificaciones } })}
                          className={`relative w-9 h-5 rounded-full transition-colors ${config.persona1.notificaciones ? 'bg-brand-600' : 'bg-gray-300'}`}>
                          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${config.persona1.notificaciones ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </button>
                      </label>
                    </div>
                    <input type="email" value={config.persona1.email ?? ''} placeholder="correo@ejemplo.com"
                      onChange={e => setConfig({ ...config, persona1: { ...config.persona1, email: e.target.value } })}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Moneda del salario</label>
                    <select value={config.persona1.moneda}
                      onChange={e => setConfig({
                        ...config,
                        persona1: { ...config.persona1, moneda: e.target.value },
                        moneda: e.target.value,
                      })}
                      className={inputCls}>
                      {MONEDAS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Salario anual</label>
                    <input type="number" min="0" value={config.persona1.salario || ''} placeholder="0.00"
                      onChange={e => setConfig({ ...config, persona1: { ...config.persona1, salario: parseFloat(e.target.value) || 0 } })}
                      className={inputCls} />
                  </div>
                </div>

                {/* Persona 2 */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-700">Persona 2</h3>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Nombre</label>
                    <input type="text" value={config.persona2.nombre} placeholder="Nombre de tu pareja"
                      onChange={e => setConfig({ ...config, persona2: { ...config.persona2, nombre: e.target.value } })}
                      className={inputCls} />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-gray-500">Correo electrónico</label>
                      <label className="flex items-center gap-1.5 cursor-pointer select-none">
                        <span className="text-xs text-gray-400">Notificaciones</span>
                        <button
                          type="button"
                          onClick={() => setConfig({ ...config, persona2: { ...config.persona2, notificaciones: !config.persona2.notificaciones } })}
                          className={`relative w-9 h-5 rounded-full transition-colors ${config.persona2.notificaciones ? 'bg-brand-600' : 'bg-gray-300'}`}>
                          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${config.persona2.notificaciones ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </button>
                      </label>
                    </div>
                    <input type="email" value={config.persona2.email ?? ''} placeholder="correo@ejemplo.com"
                      onChange={e => setConfig({ ...config, persona2: { ...config.persona2, email: e.target.value } })}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Moneda del salario</label>
                    <select value={config.persona2.moneda}
                      onChange={e => setConfig({ ...config, persona2: { ...config.persona2, moneda: e.target.value } })}
                      className={inputCls}>
                      {MONEDAS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Salario anual</label>
                    <input type="number" min="0" value={config.persona2.salario || ''} placeholder="0.00"
                      onChange={e => setConfig({ ...config, persona2: { ...config.persona2, salario: parseFloat(e.target.value) || 0 } })}
                      className={inputCls} />
                  </div>
                </div>
              </div>

              {/* Tipo de cambio */}
              {monedasDiferentes && monedaExtranjera && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <label className="block text-xs font-medium text-amber-800 mb-1">
                    Tipo de cambio: 1 {monedaExtranjera} = ? {config.moneda}
                  </label>
                  <input type="number" min="0" step="0.01" placeholder="3.75"
                    value={config.tipoCambio || ''}
                    onChange={e => setConfig({ ...config, tipoCambio: parseFloat(e.target.value) || 1 })}
                    className="w-40 border border-amber-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white" />
                  <p className="text-xs text-amber-700 mt-2">Usado solo para calcular la proporción de gastos compartidos.</p>
                </div>
              )}

              {/* Proporción */}
              {totalBase > 0 && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs font-medium text-gray-600 mb-2">Proporción de gastos compartidos</p>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-2 rounded-full bg-brand-500" style={{ width: `${pct1}%`, minWidth: '4px' }} />
                    <span className="text-xs text-gray-600">{config.persona1.nombre || 'Persona 1'}: <strong>{pct1}%</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 rounded-full bg-blue-400" style={{ width: `${pct2}%`, minWidth: '4px' }} />
                    <span className="text-xs text-gray-600">{config.persona2.nombre || 'Persona 2'}: <strong>{pct2}%</strong></span>
                  </div>
                </div>
              )}

              {/* Moneda base */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Moneda base (para mostrar totales)</label>
                <select value={config.moneda}
                  onChange={e => setConfig({ ...config, moneda: e.target.value })}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                  {MONEDAS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>

              {/* Notificaciones */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-base">🔔</span>
                  <div>
                    <p className="text-sm font-medium text-blue-800">Notificaciones por correo</p>
                    <p className="text-xs text-blue-600 mt-0.5">
                      Recibirás un aviso <strong>3 días antes</strong> del vencimiento y otro si el pago <strong>venció ayer sin estar marcado como pagado</strong>.
                      Las notificaciones se envían diariamente a las 8:00 AM.
                      Requiere configurar las variables de entorno SMTP en el servidor.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <button type="button" onClick={probarNotificacion} disabled={probandoEmail}
                    className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                    {probandoEmail ? 'Ejecutando…' : 'Probar ahora'}
                  </button>
                  {resultadoEmail && (
                    <span className={`text-xs font-medium ${resultadoEmail.startsWith('✓') ? 'text-green-600' : 'text-red-600'}`}>
                      {resultadoEmail}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <button type="submit" disabled={guardando}
                  className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors">
                  {guardando ? 'Guardando…' : 'Guardar configuración'}
                </button>
                {guardadoOk  && <span className="text-sm text-green-600">✓ Guardado correctamente</span>}
                {errorGuardado && <span className="text-sm text-red-600">{errorGuardado}</span>}
              </div>
            </form>
          )}
        </section>
      )}

      {/* ════ TAB SERVICIOS ══════════════════════════════════════ */}
      {tab === 'servicios' && (
        <div className="space-y-4">
          {/* Cabecera */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-800">Servicios del hogar</h2>
              <p className="text-xs text-gray-500 mt-0.5">Luz, agua, gas, internet y otros gastos recurrentes</p>
            </div>
            {!mostrandoForm && (
              <button onClick={() => { setEditandoId(null); setForm(FORM_INICIAL); setHelper(null); setMostrandoForm(true) }}
                className="px-3 py-1.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors">
                + Agregar
              </button>
            )}
          </div>

          {/* Formulario */}
          {mostrandoForm && (
            <form onSubmit={guardarServicio} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
              <h3 className="font-semibold text-gray-800">{editandoId ? 'Editar servicio' : 'Nuevo servicio'}</h3>

              {/* Nombre */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nombre del servicio</label>
                <input type="text" required value={form.nombre}
                  onChange={e => setForm({ ...form, nombre: e.target.value })}
                  className={inputCls} placeholder="Ej. Luz Enel, Agua SEDAPAL, Netflix…" />
              </div>

              {/* Categoría */}
              <div>
                <label className="block text-xs text-gray-500 mb-2">Categoría sugerida</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIAS.map(cat => (
                    <button key={cat.value} type="button"
                      onClick={() => setForm({ ...form, categoria: cat.value })}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        form.categoria === cat.value
                          ? 'bg-brand-600 text-white border-brand-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-brand-400'
                      }`}>
                      {cat.emoji} {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tipo de gasto */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-gray-500">Tipo de gasto</span>
                  <BtnHelper onClick={() => setHelper(helper === 'tipoGasto' ? null : 'tipoGasto')} />
                </div>
                {helper === 'tipoGasto' && (
                  <HelperBox>
                    <p><strong>Fijo:</strong> el monto es siempre el mismo. Ej: Netflix = S/.35/mes exactos.</p>
                    <p><strong>Variable:</strong> cambia según el consumo. El monto se ingresa al registrar el pago mensual.</p>
                  </HelperBox>
                )}
                <div className="flex gap-4 mt-2">
                  {(['variable', 'fijo'] as const).map(tipo => (
                    <label key={tipo} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="tipoGasto" checked={form.tipoGasto === tipo}
                        onChange={() => setForm({ ...form, tipoGasto: tipo })}
                        className="accent-brand-600" />
                      <span className="text-sm">{tipo === 'fijo' ? 'Fijo' : 'Variable'}</span>
                    </label>
                  ))}
                </div>
                {form.tipoGasto === 'fijo' && (
                  <div className="mt-3">
                    <label className="block text-xs text-gray-500 mb-1">Monto fijo ({config.moneda})</label>
                    <input type="number" min="0" step="0.01" placeholder="0.00"
                      value={form.montoFijo}
                      onChange={e => setForm({ ...form, montoFijo: e.target.value })}
                      className="w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  </div>
                )}
              </div>

              {/* Periodicidad */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-gray-500">Periodicidad</span>
                  <BtnHelper onClick={() => setHelper(helper === 'periodicidad' ? null : 'periodicidad')} />
                </div>
                {helper === 'periodicidad' && (
                  <HelperBox>
                    <p><strong>Mensual:</strong> se paga todos los meses del año.</p>
                    <p><strong>Anual:</strong> se paga una sola vez al año. Ej: SOAT, seguro del hogar.</p>
                    <p><strong>Personalizado:</strong> solo ciertos meses. Ej: calefacción de mayo a agosto.</p>
                  </HelperBox>
                )}
                <div className="flex flex-wrap gap-4 mt-2">
                  {([
                    { value: 'mensual',      label: 'Mensual' },
                    { value: 'anual',         label: 'Anual' },
                    { value: 'personalizado', label: 'Personalizado' },
                  ] as const).map(op => (
                    <label key={op.value} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="periodicidad" checked={form.periodicidad === op.value}
                        onChange={() => setForm({ ...form, periodicidad: op.value })}
                        className="accent-brand-600" />
                      <span className="text-sm">{op.label}</span>
                    </label>
                  ))}
                </div>
                {form.periodicidad === 'personalizado' && (
                  <div className="flex items-center gap-3 mt-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Desde</label>
                      <select value={form.mesInicio}
                        onChange={e => setForm({ ...form, mesInicio: e.target.value })}
                        className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                        <option value="">Mes</option>
                        {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                      </select>
                    </div>
                    <span className="text-gray-400 mt-4">→</span>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Hasta</label>
                      <select value={form.mesFin}
                        onChange={e => setForm({ ...form, mesFin: e.target.value })}
                        className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                        <option value="">Mes</option>
                        {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Día de vencimiento */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Día de vencimiento mensual</label>
                <div className="flex items-center gap-2">
                  <input type="number" min="1" max="31" placeholder="15"
                    value={form.diaVencimiento}
                    onChange={e => setForm({ ...form, diaVencimiento: e.target.value })}
                    className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  <span className="text-xs text-gray-400">de cada mes (opcional)</span>
                </div>
              </div>

              {/* Cuota doble */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={form.cuotaDoble}
                      onChange={e => setForm({ ...form, cuotaDoble: e.target.checked, mesesCuotaDoble: [] })}
                      className="w-4 h-4 accent-brand-600"
                    />
                    <span className="text-sm font-medium text-gray-700">Cuota doble en ciertos meses</span>
                  </label>
                  <BtnHelper onClick={() => setHelper(helper === 'cuotaDoble' ? null : 'cuotaDoble')} />
                </div>
                {helper === 'cuotaDoble' && (
                  <HelperBox>
                    <p><strong>Cuota doble:</strong> activa esta opción cuando el crédito exige pagar dos cuotas en meses específicos (p. ej. marzo y septiembre en algunos créditos hipotecarios). En esos meses el dashboard pre-cargará automáticamente el doble del monto fijo.</p>
                  </HelperBox>
                )}
                {form.cuotaDoble && (
                  <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <p className="text-xs text-orange-700 font-medium mb-2">Selecciona los meses con cuota doble:</p>
                    <div className="grid grid-cols-6 gap-1.5">
                      {MESES.map((m, i) => {
                        const num = i + 1
                        const activo = form.mesesCuotaDoble.includes(num)
                        return (
                          <button key={num} type="button"
                            onClick={() => {
                              const arr = activo
                                ? form.mesesCuotaDoble.filter(x => x !== num)
                                : [...form.mesesCuotaDoble, num].sort((a, b) => a - b)
                              setForm({ ...form, mesesCuotaDoble: arr })
                            }}
                            className={`py-1 rounded text-xs font-medium border transition-colors ${
                              activo
                                ? 'bg-orange-500 text-white border-orange-500'
                                : 'bg-white text-gray-600 border-gray-300 hover:border-orange-400 hover:text-orange-600'
                            }`}>
                            {m}
                          </button>
                        )
                      })}
                    </div>
                    {form.mesesCuotaDoble.length > 0 && (
                      <p className="text-xs text-orange-600 mt-2">
                        Meses con ×2: {form.mesesCuotaDoble.map(n => MESES[n - 1]).join(', ')}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Comentario */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Comentario / referencia{' '}
                  <span className="text-gray-400">({form.comentario.length}/100 caracteres)</span>
                </label>
                <textarea
                  rows={2}
                  maxLength={100}
                  placeholder="Ej: Código de suministro 123456, número de cuenta, etc."
                  value={form.comentario}
                  onChange={e => setForm({ ...form, comentario: e.target.value })}
                  className={`${inputCls} resize-none`}
                />
              </div>

              {/* Acciones */}
              <div className="flex items-center gap-3 pt-1">
                <button type="submit" disabled={guardandoServ}
                  className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors">
                  {guardandoServ ? 'Guardando…' : editandoId ? 'Guardar cambios' : 'Guardar servicio'}
                </button>
                <button type="button" onClick={cancelarForm}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {/* Lista */}
          {cargandoServs ? (
            <div className="text-center py-8 text-sm text-gray-400">Cargando servicios…</div>
          ) : servicios.length === 0 && !mostrandoForm ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <p className="text-3xl mb-2">🔌</p>
              <p className="text-sm font-medium text-gray-600">Sin servicios registrados</p>
              <p className="text-xs text-gray-400 mt-1">Agrega los servicios del hogar que comparten</p>
            </div>
          ) : (
            <div className="space-y-2">
              {servicios.map(s => {
                const cat = catInfo(s.categoria)
                return (
                  <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xl flex-shrink-0">{cat.emoji}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-gray-900 truncate">{s.nombre}</p>
                          {s.cuotaDoble && s.mesesCuotaDoble.length > 0 && (
                            <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-medium flex-shrink-0">×2</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400">
                          {cat.label} · {labelPer(s)}{s.diaVencimiento ? ` · vence día ${s.diaVencimiento}` : ''}
                          {s.cuotaDoble && s.mesesCuotaDoble.length > 0
                            ? ` · Meses dobles: ${s.mesesCuotaDoble.map(n => MESES[n - 1]).join(', ')}`
                            : ''}
                          {s.comentario ? ` · 💬 ${s.comentario}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
                        s.tipoGasto === 'fijo' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {s.tipoGasto === 'fijo'
                          ? `Fijo · ${config.moneda} ${s.montoFijo?.toLocaleString()}`
                          : 'Variable'}
                      </span>
                      <button onClick={() => abrirEditar(s)}
                        className="text-xs text-brand-600 hover:text-brand-700 transition-colors">
                        Editar
                      </button>
                      <button onClick={() => eliminarServicio(s.id)}
                        className="text-xs text-red-400 hover:text-red-600 transition-colors">
                        Eliminar
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ════ TAB ÚNICOS ══════════════════════════════════════════ */}
      {tab === 'unicos' && (
        <div className="space-y-4">
          {/* Cabecera */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-800">Gastos Únicos</h2>
              <p className="text-xs text-gray-500 mt-0.5">Plantillas reutilizables para gastos puntuales (citas médicas, reparaciones, etc.)</p>
            </div>
            {!mostrandoFormUnico && (
              <button onClick={() => { setEditandoUnicoId(null); setFormUnico({ nombre: '', categoria: 'otro', montoRef: '', comentario: '' }); setMostrandoFormUnico(true) }}
                className="px-3 py-1.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors">
                + Agregar
              </button>
            )}
          </div>

          {/* Formulario */}
          {mostrandoFormUnico && (
            <form onSubmit={guardarUnico} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
              <h3 className="font-semibold text-gray-800">{editandoUnicoId ? 'Editar gasto único' : 'Nuevo gasto único'}</h3>

              {/* Nombre */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nombre del gasto</label>
                <input type="text" required value={formUnico.nombre}
                  onChange={e => setFormUnico({ ...formUnico, nombre: e.target.value })}
                  className={inputCls} placeholder="Ej. Cita Médica, Reparación de baño…" />
              </div>

              {/* Categoría */}
              <div>
                <label className="block text-xs text-gray-500 mb-2">Categoría</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIAS.map(cat => (
                    <button key={cat.value} type="button"
                      onClick={() => setFormUnico({ ...formUnico, categoria: cat.value })}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        formUnico.categoria === cat.value
                          ? 'bg-brand-600 text-white border-brand-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-brand-400'
                      }`}>
                      {cat.emoji} {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Monto de referencia */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Monto de referencia ({config.moneda}) <span className="text-gray-400">— opcional</span></label>
                <input type="text" inputMode="decimal" value={formUnico.montoRef}
                  onChange={e => setFormUnico({ ...formUnico, montoRef: e.target.value })}
                  className="w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="0.00" />
                <p className="text-xs text-gray-400 mt-1">Se usará como valor sugerido al agregar al dashboard.</p>
              </div>

              {/* Comentario */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Comentario / referencia{' '}
                  <span className="text-gray-400">({formUnico.comentario.length}/100 caracteres)</span>
                </label>
                <textarea
                  rows={2}
                  maxLength={100}
                  placeholder="Ej: Dr. García – Clínica San Pablo, Número de referencia, etc."
                  value={formUnico.comentario}
                  onChange={e => setFormUnico({ ...formUnico, comentario: e.target.value })}
                  className={`${inputCls} resize-none`}
                />
              </div>

              {/* Acciones */}
              <div className="flex items-center gap-3 pt-1">
                <button type="submit" disabled={guardandoUnico}
                  className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors">
                  {guardandoUnico ? 'Guardando…' : editandoUnicoId ? 'Guardar cambios' : 'Guardar plantilla'}
                </button>
                <button type="button" onClick={cancelarFormUnico}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {/* Lista */}
          {cargandoUnicos ? (
            <div className="text-center py-8 text-sm text-gray-400">Cargando gastos únicos…</div>
          ) : unicos.length === 0 && !mostrandoFormUnico ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <p className="text-3xl mb-2">💰</p>
              <p className="text-sm font-medium text-gray-600">Sin gastos únicos registrados</p>
              <p className="text-xs text-gray-400 mt-1">Crea plantillas para gastos puntuales que puedes reutilizar en el dashboard</p>
            </div>
          ) : (
            <div className="space-y-2">
              {unicos.map(g => {
                const cat = catInfo(g.categoria)
                return (
                  <div key={g.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xl flex-shrink-0">{cat.emoji}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{g.nombre}</p>
                        <p className="text-xs text-gray-400">
                          {cat.label}
                          {g.montoRef != null ? ` · ${config.moneda} ${g.montoRef.toLocaleString()}` : ''}
                          {g.comentario ? ` · 💬 ${g.comentario}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <button onClick={() => abrirEditarUnico(g)}
                        className="text-xs text-brand-600 hover:text-brand-700 transition-colors">
                        Editar
                      </button>
                      <button onClick={() => eliminarUnico(g.id)}
                        className="text-xs text-red-400 hover:text-red-600 transition-colors">
                        Eliminar
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
