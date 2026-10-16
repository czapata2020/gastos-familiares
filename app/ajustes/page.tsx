'use client'

import { useEffect, useState } from 'react'
import { Download, FileSpreadsheet, Pencil, Plus, Trash2, Upload } from 'lucide-react'
import type { Asignacion, Categoria, Concepto, Config, Persona, Reparto, TipoConcepto } from '@/types'
import { api, dinero, parseMonto, useDatos } from '@/lib/cliente'
import { conceptoFinalizado, MESES, MESES_CORTO, porcentajePersona1 } from '@/lib/reparto'
import { CATEGORIAS, MONEDAS, nombreCategoria } from '@/lib/categorias'
import {
  BarraReparto, btnPrimario, btnSecundario, Cargando, Chips, Encabezado, Hoja, inputCls, nombreCorto, Seccion, Sigla, Tarjeta, useAviso,
} from '@/components/ui'

interface Ajustes { config: Config; personas: [Persona, Persona]; usuario: string }

const labelCls = 'grid gap-1 text-sm font-semibold text-ink-2'
const fmtPeriodo = (p: string) => { const [a, m] = p.split('-'); return `${MESES[Number(m) - 1]} ${a}` }

export default function AjustesPage() {
  const aj = useDatos<Ajustes>('/api/ajustes')
  const rep = useDatos<Reparto[]>('/api/repartos')
  const con = useDatos<Concepto[]>('/api/conceptos')
  const { aviso, nodo } = useAviso()

  if (!aj.data || !rep.data || !con.data) return <><Encabezado titulo="Ajustes" /><Cargando /></>
  const { config, personas, usuario } = aj.data

  return (
    <>
      <Encabezado titulo="Ajustes" />
      {nodo}
      <div className="grid gap-6">
        <SeccionReparto repartos={rep.data} personas={personas} config={config}
          onCambio={async () => { await rep.recargar() }} onConfig={async () => { await aj.recargar() }} aviso={aviso} />
        <SeccionConceptos conceptos={con.data} personas={personas} moneda={config.monedaBase} auto={config.asignacionAuto}
          onCambio={async () => { await con.recargar() }} aviso={aviso} />
        <SeccionHogar ajustes={aj.data} onCambio={async () => { await aj.recargar() }} aviso={aviso} />
        <SeccionNotificaciones aviso={aviso} />
        <SeccionPlantilla aviso={aviso} moneda={config.monedaBase} />
        <Seccion titulo="Datos">
          <Tarjeta className="grid gap-3 text-sm">
            <a href="/api/exportar" className={`${btnSecundario} justify-self-start`}><Download className="h-4 w-4" />Descargar todo en CSV (Excel)</a>
            <p className="text-ink-3">La base se respalda sola todos los días en el servidor (se guardan 14 copias).</p>
            {usuario && <p className="text-ink-3">Sesión: {usuario}</p>}
          </Tarjeta>
        </Seccion>
      </div>
    </>
  )
}

// ── Reparto por salario ───────────────────────────────────────────────────────

function SeccionReparto({ repartos, personas, config, onCambio, onConfig, aviso }: {
  repartos: Reparto[]; personas: [Persona, Persona]; config: Config; onCambio: () => Promise<void>
  onConfig: () => Promise<void>; aviso: (m: string, e?: boolean) => void
}) {
  async function alternarAuto() {
    try {
      await api('/api/ajustes', 'PUT', { asignacionAuto: !config.asignacionAuto })
      await onConfig()
      aviso(config.asignacionAuto ? 'Asignación automática desactivada' : 'Asignación automática activada')
    } catch (e) { aviso((e as Error).message, true) }
  }
  const [editando, setEditando] = useState<Partial<Reparto> | null>(null)
  const hoy = new Date()
  const n1 = nombreCorto(personas[0]), n2 = nombreCorto(personas[1])

  async function borrar(id: string) {
    try { await api(`/api/repartos/${id}`, 'DELETE'); await onCambio(); aviso('Periodo eliminado') } catch (e) { aviso((e as Error).message, true) }
  }

  return (
    <Seccion titulo="Reparto por salario" extra="según el ingreso de cada uno">
      <Tarjeta className="flex items-center justify-between gap-4 text-sm">
        <div className="min-w-0">
          <p className="font-semibold">Asignación automática</p>
          <p className="text-ink-3">Cada uno tiene su grupo de gastos fijos que paga completos, sin depositarse partes. El grupo se mantiene mes a mes y solo cambia si el año se aleja más de 3 puntos de este %. Los ocasionales los paga quien los registra.</p>
        </div>
        <button type="button" role="switch" aria-checked={config.asignacionAuto} aria-label="Asignación automática" onClick={alternarAuto}
          className={`relative h-7 w-12 shrink-0 rounded-full transition ${config.asignacionAuto ? 'bg-accent' : 'bg-line'}`}>
          <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-surface shadow transition-all ${config.asignacionAuto ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
      </Tarjeta>
      <Tarjeta className="grid gap-1 !py-2">
        {repartos.map((r, i) => {
          const p1 = porcentajePersona1(r, config.monedaBase)
          return (
            <div key={r.id} className="grid gap-2 border-t border-line py-3 first:border-0">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{i === 0 ? 'Vigente desde' : 'Desde'} {fmtPeriodo(r.desde)}</p>
                  <p className="num text-xs text-ink-3">
                    {r.porcentajeManual != null ? 'Porcentaje manual' : `${n1} ${dinero(r.salario1, r.moneda1)} · ${n2} ${dinero(r.salario2, r.moneda2)} ${r.periodo === 'anual' ? 'al año' : 'al mes'}${r.moneda1 !== r.moneda2 ? ` · TC ${r.tipoCambio}` : ''}`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button type="button" aria-label="Editar periodo" onClick={() => setEditando(r)} className="grid h-9 w-9 place-items-center rounded-full text-ink-3 hover:bg-surface-2"><Pencil className="h-4 w-4" /></button>
                  {repartos.length > 1 && <button type="button" aria-label="Eliminar periodo" onClick={() => borrar(r.id)} className="grid h-9 w-9 place-items-center rounded-full text-ink-3 hover:text-bad"><Trash2 className="h-4 w-4" /></button>}
                </div>
              </div>
              <BarraReparto a={p1} b={100 - p1} />
              <div className="num flex justify-between text-sm font-bold"><span className="text-p1">{n1} {p1.toFixed(1)}%</span><span className="text-p2">{n2} {(100 - p1).toFixed(1)}%</span></div>
            </div>
          )
        })}
      </Tarjeta>
      <button type="button" className={`${btnSecundario} justify-self-start`}
        onClick={() => setEditando({ ...(repartos[0] ?? {}), id: undefined, desde: `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}` })}>
        <Plus className="h-4 w-4" />Cambio de salario
      </button>
      <p className="px-1 text-xs text-ink-3">Si un salario cambia, agrega un periodo nuevo desde ese mes: los meses anteriores conservan su porcentaje.</p>
      <HojaReparto valor={editando} onCerrar={() => setEditando(null)} personas={personas} config={config}
        onGuardado={async () => { setEditando(null); await onCambio(); aviso('Reparto guardado') }} aviso={aviso} />
    </Seccion>
  )
}

function HojaReparto({ valor, onCerrar, personas, config, onGuardado, aviso }: {
  valor: Partial<Reparto> | null; onCerrar: () => void; personas: [Persona, Persona]; config: Config
  onGuardado: () => Promise<void>; aviso: (m: string, e?: boolean) => void
}) {
  const [f, setF] = useState({ desde: '', salario1: '', moneda1: 'PEN', salario2: '', moneda2: 'PEN', tipoCambio: '1', manual: '', usarManual: false, periodo: 'mensual' as Reparto['periodo'] })
  useEffect(() => {
    if (!valor) return
    setF({
      desde: valor.desde ?? '', salario1: String(valor.salario1 ?? ''), moneda1: valor.moneda1 ?? config.monedaBase,
      salario2: String(valor.salario2 ?? ''), moneda2: valor.moneda2 ?? config.monedaBase, tipoCambio: String(valor.tipoCambio ?? 1),
      manual: valor.porcentajeManual != null ? String(valor.porcentajeManual) : '', usarManual: valor.porcentajeManual != null,
      periodo: valor.periodo ?? 'mensual',
    })
  }, [valor, config.monedaBase])

  const previa: Reparto = {
    id: '', desde: f.desde, salario1: parseMonto(f.salario1) ?? 0, moneda1: f.moneda1, salario2: parseMonto(f.salario2) ?? 0,
    moneda2: f.moneda2, tipoCambio: parseMonto(f.tipoCambio) ?? 1, porcentajeManual: f.usarManual ? parseMonto(f.manual) : null,
    periodo: f.periodo,
  }
  const p1 = porcentajePersona1(previa, config.monedaBase)
  const necesitaTC = f.moneda1 !== config.monedaBase || f.moneda2 !== config.monedaBase

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    try {
      await api('/api/repartos', 'POST', { ...previa, id: valor?.id, porcentajeManual: f.usarManual ? f.manual : null })
      await onGuardado()
    } catch (err) { aviso((err as Error).message, true) }
  }

  return (
    <Hoja abierta={!!valor} onCerrar={onCerrar} titulo={valor?.id ? 'Editar periodo' : 'Nuevo periodo de salarios'}>
      <form onSubmit={guardar} className="grid gap-4">
        <label className={labelCls}>Vigente desde
          <input id="rp-desde" type="month" className={inputCls} value={f.desde} onChange={e => setF({ ...f, desde: e.target.value })} required />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input id="rp-manual-on" type="checkbox" checked={f.usarManual} onChange={e => setF({ ...f, usarManual: e.target.checked })} className="h-5 w-5 accent-[rgb(var(--accent))]" />
          Definir el porcentaje a mano (sin salarios)
        </label>
        {f.usarManual ? (
          <label className={labelCls}>% que paga {nombreCorto(personas[0])}
            <input id="rp-manual" inputMode="decimal" className={`${inputCls} num`} value={f.manual} onChange={e => setF({ ...f, manual: e.target.value })} placeholder="60" />
          </label>
        ) : (
          <>
            <div className="grid gap-1.5">
              <span className="text-sm font-semibold text-ink-2">Los salarios son</span>
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1">
                {(['mensual', 'anual'] as const).map(p => (
                  <button key={p} type="button" onClick={() => setF({ ...f, periodo: p })}
                    className={`rounded-lg py-2 text-sm font-semibold ${f.periodo === p ? 'bg-surface shadow-sm' : 'text-ink-3'}`}>{p === 'mensual' ? 'Mensuales' : 'Anuales'}</button>
                ))}
              </div>
            </div>
            {([1, 2] as const).map(n => (
              <div key={n} className="grid grid-cols-[1fr_96px] gap-2">
                <label className={labelCls}>Salario {f.periodo === 'anual' ? 'anual' : 'mensual'} de {nombreCorto(personas[n - 1])}
                  <input id={`rp-sal${n}`} inputMode="decimal" className={`${inputCls} num`} value={n === 1 ? f.salario1 : f.salario2}
                    onChange={e => setF({ ...f, [`salario${n}`]: e.target.value })} placeholder="0" />
                </label>
                <label className={labelCls}>Moneda
                  <select id={`rp-mon${n}`} className={inputCls} value={n === 1 ? f.moneda1 : f.moneda2} onChange={e => setF({ ...f, [`moneda${n}`]: e.target.value })}>
                    {MONEDAS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </label>
              </div>
            ))}
            {necesitaTC && (
              <label className={labelCls}>Tipo de cambio (1 moneda extranjera = ? {config.monedaBase})
                <input id="rp-tc" inputMode="decimal" className={`${inputCls} num`} value={f.tipoCambio} onChange={e => setF({ ...f, tipoCambio: e.target.value })} />
              </label>
            )}
            <p className="text-xs text-ink-3">Usa el mismo criterio para los dos (ambos netos o ambos brutos). El % sale igual con salarios mensuales o anuales.</p>
          </>
        )}
        <div className="grid gap-1.5 rounded-xl bg-surface-2 p-3">
          <BarraReparto a={p1} b={100 - p1} />
          <div className="num flex justify-between text-sm font-bold"><span className="text-p1">{nombreCorto(personas[0])} {p1.toFixed(1)}%</span><span className="text-p2">{nombreCorto(personas[1])} {(100 - p1).toFixed(1)}%</span></div>
        </div>
        <button type="submit" className={btnPrimario}>Guardar</button>
      </form>
    </Hoja>
  )
}

// ── Gastos recurrentes y frecuentes ───────────────────────────────────────────

const TIPOS: { id: TipoConcepto; nombre: string; ayuda: string }[] = [
  { id: 'fijo', nombre: 'Fijo', ayuda: 'Mismo monto cada mes (hipoteca, nana, colegio).' },
  { id: 'variable', nombre: 'Variable', ayuda: 'Llega cada mes pero cambia el monto (luz, agua, súper).' },
  { id: 'ocasional', nombre: 'Frecuente', ayuda: 'No es mensual; aparece como atajo al agregar un gasto ocasional.' },
]

function SeccionConceptos({ conceptos, personas, moneda, auto, onCambio, aviso }: {
  conceptos: Concepto[]; personas: [Persona, Persona]; moneda: string; auto: boolean; onCambio: () => Promise<void>; aviso: (m: string, e?: boolean) => void
}) {
  const [editando, setEditando] = useState<Partial<Concepto> | null>(null)
  const [verArchivados, setVerArchivados] = useState(false)
  // Finalizados: recurrentes cuya última cuota ya pasó. Se ocultan junto con los archivados.
  const vigente = (c: Concepto) => c.activo && !conceptoFinalizado(c)
  const visibles = conceptos.filter(c => verArchivados || vigente(c))
  const archivados = conceptos.filter(c => !vigente(c)).length
  const quien = (a: Asignacion) => a === 'ambos' ? (auto ? 'Automático' : 'Ambos') : nombreCorto(personas[a === '1' ? 0 : 1])

  return (
    <Seccion titulo="Gastos recurrentes" extra={`${conceptos.filter(vigente).length} activos`}>
      {TIPOS.map(t => {
        const lista = visibles.filter(c => c.tipo === t.id)
        if (!lista.length) return null
        return (
          <Tarjeta key={t.id} className="!py-1">
            <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-ink-3">{t.id === 'ocasional' ? 'Frecuentes' : t.nombre + 's'}</p>
            {lista.map(c => (
              <button key={c.id} type="button" onClick={() => setEditando(c)}
                className={`flex w-full items-center gap-3 border-t border-line py-3 text-left first-of-type:border-0 ${vigente(c) ? '' : 'opacity-50'}`}>
                <Sigla categoria={c.categoria} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{c.nombre}{!c.activo ? ' (archivado)' : conceptoFinalizado(c) ? ' (finalizado)' : ''}</p>
                  <p className="truncate text-xs text-ink-3">
                    {nombreCategoria(c.categoria)} · {quien(c.asignadoDefault)}{c.diaVencimiento ? ` · vence día ${c.diaVencimiento}` : ''}
                    {c.mesesActivos.length ? ` · ${c.mesesActivos.map(m => MESES_CORTO[m - 1]).join(', ')}` : ''}
                    {c.hasta ? ` · hasta ${fmtPeriodo(c.hasta)}` : ''}
                  </p>
                </div>
                <span className="num font-semibold">{c.montoRef != null ? dinero(c.montoRef, moneda) : '—'}</span>
              </button>
            ))}
          </Tarjeta>
        )
      })}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnSecundario} onClick={() => setEditando({ tipo: 'fijo', categoria: 'hogar', asignadoDefault: 'ambos', mesesActivos: [], mesesCuotaDoble: [], activo: true })}>
          <Plus className="h-4 w-4" />Nuevo gasto
        </button>
        {archivados > 0 && <button type="button" className="px-2 text-sm font-semibold text-ink-3" onClick={() => setVerArchivados(v => !v)}>{verArchivados ? 'Ocultar' : 'Ver'} finalizados y archivados ({archivados})</button>}
      </div>
      <HojaConcepto valor={editando} onCerrar={() => setEditando(null)} personas={personas} moneda={moneda} auto={auto}
        onGuardado={async msg => { setEditando(null); await onCambio(); aviso(msg) }} aviso={aviso} />
    </Seccion>
  )
}

function HojaConcepto({ valor, onCerrar, personas, moneda, auto, onGuardado, aviso }: {
  valor: Partial<Concepto> | null; onCerrar: () => void; personas: [Persona, Persona]; moneda: string; auto: boolean
  onGuardado: (msg: string) => Promise<void>; aviso: (m: string, e?: boolean) => void
}) {
  const [f, setF] = useState<Partial<Concepto> & { montoTxt: string; diaTxt: string }>({ montoTxt: '', diaTxt: '' })
  const [confirmar, setConfirmar] = useState(false)
  useEffect(() => {
    if (valor) setF({ ...valor, montoTxt: valor.montoRef != null ? String(valor.montoRef) : '', diaTxt: valor.diaVencimiento ? String(valor.diaVencimiento) : '' })
    setConfirmar(false)
  }, [valor])

  const alternar = (campo: 'mesesActivos' | 'mesesCuotaDoble', m: number) => {
    const actual = f[campo] ?? []
    setF({ ...f, [campo]: actual.includes(m) ? actual.filter(x => x !== m) : [...actual, m].sort((a, b) => a - b) })
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    const body = { ...f, montoRef: f.montoTxt.trim() ? parseMonto(f.montoTxt) : null, diaVencimiento: f.diaTxt.trim() ? Number(f.diaTxt) : null }
    try {
      if (f.id) await api(`/api/conceptos/${f.id}`, 'PUT', body)
      else await api('/api/conceptos', 'POST', body)
      await onGuardado(`${f.nombre} guardado`)
    } catch (err) { aviso((err as Error).message, true) }
  }

  async function borrar() {
    if (!confirmar) { setConfirmar(true); return }
    try { await api(`/api/conceptos/${f.id}`, 'DELETE'); await onGuardado(`${f.nombre} eliminado`) } catch (err) { aviso((err as Error).message, true) }
  }

  const tipo = f.tipo ?? 'fijo'
  return (
    <Hoja abierta={!!valor} onCerrar={onCerrar} titulo={f.id ? 'Editar gasto' : 'Nuevo gasto'}>
      <form onSubmit={guardar} className="grid gap-4">
        <label className={labelCls}>Nombre
          <input id="co-nombre" className={inputCls} value={f.nombre ?? ''} onChange={e => setF({ ...f, nombre: e.target.value })} required placeholder="Ej. Hipoteca BCP" />
        </label>
        <div className="grid gap-1.5">
          <span className="text-sm font-semibold text-ink-2">Tipo</span>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1">
            {TIPOS.map(t => (
              <button key={t.id} type="button" onClick={() => setF({ ...f, tipo: t.id })}
                className={`rounded-lg py-2 text-sm font-semibold ${tipo === t.id ? 'bg-surface shadow-sm' : 'text-ink-3'}`}>{t.nombre}</button>
            ))}
          </div>
          <p className="text-xs text-ink-3">{TIPOS.find(t => t.id === tipo)?.ayuda}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className={labelCls}>{tipo === 'variable' ? 'Monto aproximado' : 'Monto'} ({moneda})
            <input id="co-monto" inputMode="decimal" className={`${inputCls} num`} value={f.montoTxt} onChange={e => setF({ ...f, montoTxt: e.target.value })} placeholder="Opcional" />
          </label>
          <label className={labelCls}>Categoría
            <select id="co-cat" className={inputCls} value={f.categoria ?? 'otro'} onChange={e => setF({ ...f, categoria: e.target.value as Categoria })}>
              {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </label>
        </div>
        <div className="grid gap-1.5 text-sm font-semibold text-ink-2">Quién paga normalmente
          <Chips valor={f.asignadoDefault ?? 'ambos'} personas={personas} onChange={a => setF({ ...f, asignadoDefault: a })} />
          {auto && tipo !== 'ocasional' && (
            <span className="text-xs font-normal text-ink-3">
              {(f.asignadoDefault ?? 'ambos') === 'ambos'
                ? '“Ambos” = automático: cada mes se asigna completo a quien corresponda según el ingreso.'
                : 'Siempre lo paga esta persona; la asignación automática lo cuenta pero no lo mueve.'}
            </span>
          )}
        </div>
        {tipo !== 'ocasional' && (
          <>
            <label className={labelCls}>Día de vencimiento
              <input id="co-dia" inputMode="numeric" className={`${inputCls} num w-28`} value={f.diaTxt} onChange={e => setF({ ...f, diaTxt: e.target.value.replace(/\D/g, '').slice(0, 2) })} placeholder="1-31" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className={labelCls}>Primer mes
                <input id="co-desde" type="month" className={inputCls} value={f.desde ?? ''} onChange={e => setF({ ...f, desde: e.target.value || null })} />
              </label>
              <label className={labelCls}>Último mes
                <input id="co-hasta" type="month" className={inputCls} value={f.hasta ?? ''} onChange={e => setF({ ...f, hasta: e.target.value || null })} />
              </label>
            </div>
            <p className="-mt-2 text-xs text-ink-3">Opcionales. Ej. la última cuota de un préstamo: después de ese mes deja de aparecer y pasa a “finalizados”, sin perder lo ya registrado.</p>
            <SelectorMeses titulo="Meses en que aplica" ayuda="Sin marcar = todos los meses." valor={f.mesesActivos ?? []} onToggle={m => alternar('mesesActivos', m)} />
            <SelectorMeses titulo="Meses con cuota doble" ayuda="El monto se duplica esos meses (gratificaciones, julio y diciembre)." valor={f.mesesCuotaDoble ?? []} onToggle={m => alternar('mesesCuotaDoble', m)} />
          </>
        )}
        <label className={labelCls}>Referencia para pagar
          <input id="co-nota" className={inputCls} value={f.nota ?? ''} onChange={e => setF({ ...f, nota: e.target.value })} placeholder="Código de suministro 844606" />
          <span className="text-xs font-normal text-ink-3">
            Formato: tipo, número y detalle opcional. Ej.: <i>Código de suministro 844606</i> · <i>Cuenta BCP 191-1234567-0-12</i> · <i>CCI Interbank 003…</i> · <i>Yape 990999421 · Sra. Margarita</i>. En Inicio el número se copia con un toque.
          </span>
        </label>
        {f.id && (
          <label className="flex items-center gap-2 text-sm">
            <input id="co-activo" type="checkbox" checked={f.activo !== false} onChange={e => setF({ ...f, activo: e.target.checked })} className="h-5 w-5 accent-[rgb(var(--accent))]" />
            Activo (desmarca para archivarlo sin perder la historia)
          </label>
        )}
        <div className="flex items-center justify-between gap-2">
          {f.id ? (
            <button type="button" onClick={borrar} className={`rounded-full px-3 py-2 text-sm font-semibold ${confirmar ? 'bg-bad text-white' : 'text-bad'}`}>
              {confirmar ? 'Confirmar eliminar' : 'Eliminar'}
            </button>
          ) : <span />}
          <button type="submit" className={btnPrimario}>Guardar</button>
        </div>
      </form>
    </Hoja>
  )
}

function SelectorMeses({ titulo, ayuda, valor, onToggle }: { titulo: string; ayuda: string; valor: number[]; onToggle: (m: number) => void }) {
  return (
    <div className="grid gap-1.5">
      <span className="text-sm font-semibold text-ink-2">{titulo}</span>
      <div className="grid grid-cols-6 gap-1">
        {MESES_CORTO.map((m, i) => (
          <button key={m} type="button" aria-pressed={valor.includes(i + 1)} onClick={() => onToggle(i + 1)}
            className={`rounded-lg py-1.5 text-xs font-semibold ${valor.includes(i + 1) ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-ink-2'}`}>{m}</button>
        ))}
      </div>
      <span className="text-xs text-ink-3">{ayuda}</span>
    </div>
  )
}

// ── Hogar ─────────────────────────────────────────────────────────────────────

function SeccionHogar({ ajustes, onCambio, aviso }: { ajustes: Ajustes; onCambio: () => Promise<void>; aviso: (m: string, e?: boolean) => void }) {
  const [f, setF] = useState(ajustes)
  useEffect(() => setF(ajustes), [ajustes])
  const cambiado = JSON.stringify(f) !== JSON.stringify(ajustes)

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    try { await api('/api/ajustes', 'PUT', { monedaBase: f.config.monedaBase, personas: f.personas }); await onCambio(); aviso('Guardado') }
    catch (err) { aviso((err as Error).message, true) }
  }

  return (
    <Seccion titulo="Hogar">
      <Tarjeta>
        <form onSubmit={guardar} className="grid gap-4">
          {f.personas.map((p, i) => (
            <div key={p.id} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <label className={labelCls}>Persona {p.id}
                <input id={`pe-n${p.id}`} className={inputCls} value={p.nombre}
                  onChange={e => { const ps = [...f.personas] as [Persona, Persona]; ps[i] = { ...p, nombre: e.target.value }; setF({ ...f, personas: ps }) }} />
              </label>
              <label className={labelCls}>Correo
                <input id={`pe-e${p.id}`} type="email" className={inputCls} value={p.email}
                  onChange={e => { const ps = [...f.personas] as [Persona, Persona]; ps[i] = { ...p, email: e.target.value }; setF({ ...f, personas: ps }) }} />
              </label>
              <label className={`${labelCls} col-span-2 sm:col-span-1`}>WhatsApp
                <input id={`pe-t${p.id}`} type="tel" inputMode="tel" className={`${inputCls} num`} value={p.telefono} placeholder="51 987 654 321"
                  onChange={e => { const ps = [...f.personas] as [Persona, Persona]; ps[i] = { ...p, telefono: e.target.value }; setF({ ...f, personas: ps }) }} />
              </label>
            </div>
          ))}
          <p className="-mt-1 text-xs text-ink-3">El WhatsApp va con código de país (51 para Perú). Solo esos dos números pueden usar el bot.</p>
          <div className="grid gap-2 rounded-xl bg-surface-2 p-3">
            <p className="text-sm font-semibold">Bot de WhatsApp</p>
            <p className="text-xs text-ink-3">Si el bot no le responde a alguien (pasa con quien usa nombre de usuario en WhatsApp, porque Meta no envía su número), vincúlalo con un código.</p>
            {ajustes.personas.map(p => <VincularWhatsApp key={p.id} persona={p} aviso={aviso} />)}
          </div>
          <label className={`${labelCls} w-40`}>Moneda principal
            <select id="pe-moneda" className={inputCls} value={f.config.monedaBase} onChange={e => setF({ ...f, config: { ...f.config, monedaBase: e.target.value } })}>
              {MONEDAS.map(m => <option key={m}>{m}</option>)}
            </select>
          </label>
          <button type="submit" className={`${btnPrimario} justify-self-start`} disabled={!cambiado}>Guardar cambios</button>
        </form>
      </Tarjeta>
    </Seccion>
  )
}

// ── Recordatorios por correo ──────────────────────────────────────────────────

function SeccionNotificaciones({ aviso }: { aviso: (m: string, e?: boolean) => void }) {
  const { data, setData } = useDatos<{ activas: boolean; smtpConfigurado: boolean; destinatarios: string[] }>('/api/notificaciones')
  const [probando, setProbando] = useState(false)
  if (!data) return null

  async function alternar() {
    try {
      setData(await api('/api/notificaciones', 'PUT', { activas: !data!.activas }))
      aviso(data!.activas ? 'Recordatorios desactivados' : 'Recordatorios activados')
    } catch (e) { aviso((e as Error).message, true) }
  }
  async function probar() {
    setProbando(true)
    try { await api('/api/notificaciones', 'POST'); aviso('Correo de prueba enviado') } catch (e) { aviso((e as Error).message, true) } finally { setProbando(false) }
  }

  return (
    <Seccion titulo="Recordatorios por correo">
      <Tarjeta className="grid gap-3 text-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold">Avisar vencimientos</p>
            <p className="text-ink-3">3 días antes y el día siguiente si sigue sin pagar.</p>
          </div>
          <button type="button" role="switch" aria-checked={data.activas} aria-label="Avisar vencimientos" onClick={alternar}
            className={`relative h-7 w-12 shrink-0 rounded-full transition ${data.activas ? 'bg-accent' : 'bg-line'}`}>
            <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-surface shadow transition-all ${data.activas ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </div>
        <p className="text-ink-3">Se envían a: {data.destinatarios.join(', ') || 'nadie (agrega correos en Hogar)'}</p>
        {!data.smtpConfigurado && <p className="rounded-xl bg-warn/10 px-3 py-2 text-warn">Falta configurar el servidor de correo (SMTP) en el servidor. Mientras tanto no se envía nada.</p>}
        {data.smtpConfigurado && <button type="button" className={`${btnSecundario} justify-self-start`} disabled={probando} onClick={probar}>Enviar correo de prueba</button>}
      </Tarjeta>
    </Seccion>
  )
}

// ── Carga masiva con plantilla Excel ─────────────────────────────────────────

interface PlanImport {
  filas: { fila: number; accion: 'crear' | 'actualizar'; nombre: string; anio: number; mes: number; monto: number; aviso: string | null }[]
  errores: { fila: number; mensaje: string }[]
  omitidas: number
  nuevos: string[]
  resumen: { crear: number; actualizar: number; borrar: number; total: number; meses: string[] }
}

function SeccionPlantilla({ aviso, moneda }: { aviso: (m: string, e?: boolean) => void; moneda: string }) {
  const hoy = new Date()
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [desde, setDesde] = useState(1)
  const [hasta, setHasta] = useState(Math.max(1, hoy.getMonth()))  // hasta el mes anterior
  const [archivo, setArchivo] = useState<File | null>(null)
  const [plan, setPlan] = useState<PlanImport | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [reemplazar, setReemplazar] = useState(false)
  const anios = [hoy.getFullYear() + 1, hoy.getFullYear(), hoy.getFullYear() - 1, hoy.getFullYear() - 2, hoy.getFullYear() - 3]

  async function subir(modo: 'previsualizar' | 'aplicar', f = archivo, borron = reemplazar) {
    if (!f) return
    setOcupado(true)
    try {
      const fd = new FormData()
      fd.append('archivo', f)
      fd.append('modo', modo)
      if (borron) fd.append('reemplazar', '1')
      const res = await fetch('/api/importar', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`)
      if (modo === 'previsualizar') setPlan(data)
      else {
        aviso(`Importado: ${data.creados} nuevos, ${data.actualizados} actualizados${data.borrados ? `, ${data.borrados} reemplazados` : ''}`)
        setPlan(null); setArchivo(null)
      }
    } catch (e) { aviso((e as Error).message, true) } finally { setOcupado(false) }
  }

  return (
    <Seccion titulo="Cargar gastos desde Excel" extra="para completar meses pasados">
      <Tarjeta className="grid gap-4 text-sm">
        <div className="grid gap-2">
          <p className="font-semibold">1. Descarga la plantilla</p>
          <p className="text-ink-3">Viene con lo ya registrado y una fila por cada gasto recurrente que falta, con su monto de referencia.</p>
          <div className="grid grid-cols-3 gap-2">
            <label className={labelCls}>Año
              <select id="pl-anio" className={inputCls} value={anio} onChange={e => setAnio(Number(e.target.value))}>
                {anios.map(a => <option key={a}>{a}</option>)}
              </select>
            </label>
            <label className={labelCls}>Desde
              <select id="pl-desde" className={inputCls} value={desde} onChange={e => { const v = Number(e.target.value); setDesde(v); if (hasta < v) setHasta(v) }}>
                {MESES.map((m, i) => <option key={m} value={i + 1}>{m.slice(0, 3)}</option>)}
              </select>
            </label>
            <label className={labelCls}>Hasta
              <select id="pl-hasta" className={inputCls} value={hasta} onChange={e => setHasta(Number(e.target.value))}>
                {MESES.map((m, i) => <option key={m} value={i + 1} disabled={i + 1 < desde}>{m.slice(0, 3)}</option>)}
              </select>
            </label>
          </div>
          <a href={`/api/plantilla?anio=${anio}&desde=${desde}&hasta=${hasta}`} className={`${btnSecundario} justify-self-start`}>
            <FileSpreadsheet className="h-4 w-4" />Descargar plantilla (.xlsx)
          </a>
        </div>

        <div className="grid gap-2 border-t border-line pt-4">
          <p className="font-semibold">2. Llénala y súbela</p>
          <p className="text-ink-3">Funciona con Excel o Google Sheets (descárgala como .xlsx). Antes de guardar verás qué se va a crear o actualizar.</p>
          <label className={`${btnSecundario} cursor-pointer justify-self-start`}>
            <Upload className="h-4 w-4" />{archivo ? archivo.name : 'Elegir archivo'}
            <input id="pl-archivo" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only"
              onChange={e => { const f = e.target.files?.[0] ?? null; setArchivo(f); setPlan(null); if (f) void subir('previsualizar', f); e.target.value = '' }} />
          </label>
          <label className="flex items-start gap-2">
            <input id="pl-reemplazar" type="checkbox" checked={reemplazar} className="mt-0.5 h-5 w-5 shrink-0 accent-[rgb(var(--accent))]"
              onChange={e => { setReemplazar(e.target.checked); if (archivo) void subir('previsualizar', archivo, e.target.checked) }} />
            <span><b>Borrón y cuenta nueva</b> en los meses del archivo: borra lo ya registrado en esos meses y carga solo lo que dice la plantilla. Los IDs se ignoran y &ldquo;Auto&rdquo; se recalcula para todos.</span>
          </label>
          {ocupado && <p className="text-ink-3">Revisando…</p>}
        </div>

        {plan && (
          <div className="grid gap-3 rounded-xl bg-surface-2 p-3">
            {plan.resumen.borrar > 0 && (
              <p className="rounded-lg bg-warn/10 p-2.5 font-semibold text-warn">
                Se borrarán {plan.resumen.borrar} pagos ya registrados en {plan.resumen.meses.join(', ')} y se reemplazarán por lo del archivo.
              </p>
            )}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><p className="num font-display text-xl font-bold">{plan.resumen.crear}</p><p className="text-xs text-ink-3">nuevos</p></div>
              <div><p className="num font-display text-xl font-bold">{plan.resumen.actualizar}</p><p className="text-xs text-ink-3">se actualizan</p></div>
              <div><p className={`num font-display text-xl font-bold ${plan.errores.length ? 'text-bad' : ''}`}>{plan.errores.length}</p><p className="text-xs text-ink-3">con error</p></div>
            </div>
            <p className="text-ink-2">
              Total {dinero(plan.resumen.total, moneda)} en {plan.resumen.meses.join(', ') || 'ningún mes'}.
              {plan.omitidas > 0 && ` ${plan.omitidas} filas sin monto se ignoran.`}
            </p>
            {plan.errores.length > 0 && (
              <div className="grid gap-1 rounded-lg bg-bad/10 p-2.5 text-bad">
                <p className="font-semibold">Corrige estas filas y vuelve a subir el archivo:</p>
                {plan.errores.slice(0, 15).map(e => <p key={e.fila}>Fila {e.fila}: {e.mensaje}</p>)}
                {plan.errores.length > 15 && <p>…y {plan.errores.length - 15} más</p>}
              </div>
            )}
            {plan.nuevos.length > 0 && (
              <div className="grid gap-1 rounded-lg bg-warn/10 p-2.5 text-warn">
                <p className="font-semibold">Estos nombres no coinciden con ningún gasto recurrente y se cargarán como ocasionales (sin asignación automática):</p>
                <p>{plan.nuevos.join(', ')}</p>
                <p className="text-ink-2">Si son tus recurrentes con otro nombre, corrige el nombre en la plantilla (o renombra el gasto en Ajustes) y vuelve a subirla.</p>
              </div>
            )}
            {plan.filas.some(f => f.aviso) && (
              <details className="text-ink-2">
                <summary className="cursor-pointer font-semibold">{plan.filas.filter(f => f.aviso).length} avisos (no bloquean)</summary>
                <div className="mt-1 grid gap-0.5">
                  {plan.filas.filter(f => f.aviso).slice(0, 30).map(f => <p key={f.fila}>Fila {f.fila} · {f.nombre}: {f.aviso}</p>)}
                </div>
              </details>
            )}
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btnPrimario} disabled={ocupado || plan.errores.length > 0 || plan.filas.length === 0} onClick={() => subir('aplicar')}>
                {plan.resumen.borrar > 0 ? `Reemplazar e importar ${plan.filas.length} filas` : `Importar ${plan.filas.length} filas`}
              </button>
              <button type="button" className={btnSecundario} onClick={() => { setPlan(null); setArchivo(null) }}>Cancelar</button>
            </div>
          </div>
        )}
      </Tarjeta>
    </Seccion>
  )
}

function VincularWhatsApp({ persona, aviso }: { persona: Persona; aviso: (m: string, e?: boolean) => void }) {
  const [codigo, setCodigo] = useState<string | null>(null)
  async function generar() {
    try { setCodigo((await api<{ codigo: string }>('/api/whatsapp/vincular', 'POST', { personaId: persona.id })).codigo) }
    catch (e) { aviso((e as Error).message, true) }
  }
  return (
    <div className="grid gap-1.5 border-t border-line pt-2 text-sm first-of-type:border-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          <b>{nombreCorto(persona)}</b>{' '}
          <span className="text-xs text-ink-3">{persona.waUserId ? '· vinculado por ID de WhatsApp' : persona.telefono ? '· reconocido por número' : '· sin WhatsApp'}</span>
        </span>
        <button type="button" onClick={generar} className="text-xs font-semibold text-accent underline underline-offset-2">
          {codigo ? 'Generar otro código' : 'Vincular con código'}
        </button>
      </div>
      {codigo && (
        <p className="rounded-lg bg-surface px-3 py-2 text-xs text-ink-2">
          Desde el WhatsApp de {nombreCorto(persona)}, envía al <b>+51 969 313 680</b>:{' '}
          <b className="num select-all text-base text-ink">vincular {codigo}</b>
          <br />Vence en 15 minutos y sirve una sola vez.
        </p>
      )}
    </div>
  )
}
