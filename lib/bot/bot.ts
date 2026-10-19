import 'server-only'
import type { Asignacion, Categoria, FilaMes, Persona, TipoConcepto } from '@/types'
import type { Respuesta } from '@/lib/whatsapp'
import { getDb, uid } from '@/lib/db'
import { actualizarPago, crearPago, getEstadoMes, getPersonas, personaPorRemitente } from '@/lib/repo'
import { dividir, estadoFila, MESES } from '@/lib/reparto'
import { interpretar, mejorCoincidencia, normalizar } from './interpretar'

/** Lo que se guardará si la persona toca "Guardar". */
interface Propuesta {
  pagoId: string | null
  conceptoId: string | null
  nombre: string
  categoria: Categoria
  tipo: TipoConcepto
  anio: number
  mes: number
  monto: number
  asignadoA: Asignacion
  manual: boolean
  pagado: boolean
  /** Monto que tenía el pago si ya estaba registrado (se reemplaza). */
  montoAntes?: number | null
  /** Gasto que no existía: se crea como ocasional nuevo. */
  nuevo?: boolean
}

const VIGENCIA_HORAS = 24

const dinero = (n: number, moneda: string) =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: moneda, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

const corto = (p: Persona) => p.nombre.split(' ')[0] || `Persona ${p.id}`
const quienTxt = (a: Asignacion, personas: [Persona, Persona]) =>
  a === 'ambos' ? 'Ambos (según ingreso)' : corto(personas[a === '1' ? 0 : 1])

function hoy() {
  const d = new Date()
  return { anio: d.getFullYear(), mes: d.getMonth() + 1 }
}

const AYUDA = [
  'Puedes escribirme así:',
  '• *luz 186*: registra o corrige un gasto del mes',
  '• *super 320,50 rudy*: y dice a quién le toca',
  '• *farmacia 85 pagado*: lo marca como pagado',
  '• *pagué la hipoteca*: marca un gasto como pagado',
  '• *resumen*: cuánto llevamos este mes',
  '• *pendientes*: qué falta pagar',
].join('\n')

/**
 * Procesa un mensaje entrante y devuelve las respuestas para enviar.
 * `boton` es el id de un botón tocado; si viene, `texto` se ignora.
 * Números que no están en Ajustes → Hogar se ignoran (respuesta vacía).
 */
export function procesarMensaje(waId: string, texto: string, boton?: string): Respuesta[] {
  const persona = personaPorRemitente(waId)
  if (!persona) return []
  const personas = getPersonas()

  if (boton) return [aplicarBoton(waId, boton, personas)]

  const nombres: [string, string] = [normalizar(corto(personas[0])), normalizar(corto(personas[1]))]
  const intencion = interpretar(texto, nombres)
  const { anio, mes } = hoy()

  switch (intencion.tipo) {
    case 'ayuda': return [{ texto: `Hola ${corto(persona)} 👋\n\n${AYUDA}` }]
    case 'resumen': return [resumen(anio, mes, personas)]
    case 'pendientes': return [pendientes(anio, mes, personas)]
    case 'pagar': return [marcarPagado(intencion.texto, anio, mes)]
    case 'cancelar': {
      const n = getDb().prepare('DELETE FROM wa_pendientes WHERE wa_id = ?').run(waId).changes
      return [{ texto: n ? 'Listo, descarté lo que estaba sin guardar.' : 'No había nada pendiente de guardar.' }]
    }
    case 'registrar': {
      const quien = intencion.quien === 'yo' ? persona.id : intencion.quien
      return [proponer(waId, intencion.texto, intencion.monto, quien, intencion.pagado, anio, mes, personas, persona)]
    }
    default: return [{ texto: `No te entendí.\n\n${AYUDA}` }]
  }
}

function proponer(waId: string, escrito: string, monto: number, quien: Asignacion | null, pagado: boolean,
  anio: number, mes: number, personas: [Persona, Persona], autor: Persona): Respuesta {
  const estado = getEstadoMes(anio, mes)
  const fila = mejorCoincidencia(escrito, estado.filas.filter(f => f.tipo !== 'ocasional'))
  const plantilla = fila ? null : mejorCoincidencia(escrito, estado.ocasionales)

  let p: Propuesta
  if (fila) {
    const auto = fila.pago?.asignadoA ?? fila.asignacionSugerida ?? fila.concepto?.asignadoDefault ?? 'ambos'
    p = {
      pagoId: fila.pago?.id ?? null, conceptoId: fila.concepto?.id ?? null, nombre: fila.nombre, categoria: fila.categoria,
      tipo: fila.tipo, anio, mes, monto, asignadoA: quien ?? auto, manual: quien != null, pagado,
    }
  } else {
    // Gasto ocasional: no entra a la asignación automática; lo paga quien lo registra (o quien se indique)
    const fijo = plantilla && plantilla.asignadoDefault !== 'ambos' ? plantilla.asignadoDefault : null
    p = {
      pagoId: null, conceptoId: plantilla?.id ?? null, nombre: plantilla?.nombre ?? capitalizar(escrito),
      categoria: plantilla?.categoria ?? 'otro', tipo: 'ocasional', anio, mes, monto,
      asignadoA: quien ?? fijo ?? autor.id, manual: true, pagado,
    }
  }

  p.montoAntes = fila?.pago?.monto ?? null
  p.nuevo = p.tipo === 'ocasional' && !plantilla
  const id = uid('wa')
  getDb().prepare('INSERT INTO wa_pendientes (id, wa_id, datos) VALUES (?, ?, ?)').run(id, waId, JSON.stringify(p))
  return textoPropuesta(id, p, personas, estado.config.monedaBase)
}

function textoPropuesta(id: string, p: Propuesta, personas: [Persona, Persona], mon: string): Respuesta {
  const como = p.tipo === 'ocasional' ? 'gasto ocasional' : p.manual ? 'elegido por ti' : 'automático'
  const lineas = [
    `*${p.nombre}* · ${dinero(p.monto, mon)}`,
    p.montoAntes != null
      ? `Ya tiene ${dinero(p.montoAntes, mon)} en ${MESES[p.mes - 1].toLowerCase()}. *Sumar* deja ${dinero(p.montoAntes + p.monto, mon)}; *Reemplazar* deja ${dinero(p.monto, mon)}.`
      : `${MESES[p.mes - 1]} ${p.anio}${p.nuevo ? ' · gasto nuevo' : ''}`,
    `Le toca: *${quienTxt(p.asignadoA, personas)}* (${como})`,
    p.pagado ? 'Se marcará como *pagado*.' : '',
    '',
    p.montoAntes != null ? 'Escribe *cancelar* para descartarlo.' : '¿Lo guardo? Escribe *cancelar* para descartarlo.',
  ].filter((l, k, arr) => l !== '' || arr[k - 1] !== '')
  // Si el gasto ya tiene monto este mes: sumar (compras por partes) o reemplazar
  const botones = p.montoAntes != null
    ? [{ id: `s:${id}`, titulo: 'Sumar al mes' }, { id: `g:${id}`, titulo: 'Reemplazar' }, { id: `c:${id}`, titulo: 'Cambiar persona' }]
    : p.pagado
      ? [{ id: `g:${id}`, titulo: 'Guardar' }, { id: `c:${id}`, titulo: 'Cambiar persona' }, { id: `x:${id}`, titulo: 'Cancelar' }]
      : [{ id: `g:${id}`, titulo: 'Guardar' }, { id: `gp:${id}`, titulo: 'Guardar y pagado' }, { id: `c:${id}`, titulo: 'Cambiar persona' }]
  return { texto: lineas.join('\n'), botones }
}

function aplicarBoton(waId: string, boton: string, personas: [Persona, Persona]): Respuesta {
  const [accion, id] = boton.split(':')
  const fila = getDb().prepare(
    `SELECT datos FROM wa_pendientes WHERE id = ? AND wa_id = ? AND creado_en > datetime('now', '-${VIGENCIA_HORAS} hours')`,
  ).get(id, waId) as { datos: string } | undefined
  if (!fila) return { texto: 'Esa propuesta ya no está vigente. Envíame el gasto de nuevo.' }
  const p = JSON.parse(fila.datos) as Propuesta
  const mon = getEstadoMes(p.anio, p.mes).config.monedaBase

  // Cambiar persona: se elige y se vuelve a mostrar la propuesta (sigue sin guardarse)
  if (accion === 'c') {
    return {
      texto: `¿A quién le toca *${p.nombre}* (${dinero(p.monto, mon)})?`,
      botones: [
        { id: `q1:${id}`, titulo: corto(personas[0]) },
        { id: `q2:${id}`, titulo: corto(personas[1]) },
        { id: `qa:${id}`, titulo: 'Ambos (por %)' },
      ],
    }
  }
  if (accion === 'q1' || accion === 'q2' || accion === 'qa') {
    p.asignadoA = accion === 'q1' ? '1' : accion === 'q2' ? '2' : 'ambos'
    p.manual = true
    getDb().prepare('UPDATE wa_pendientes SET datos = ? WHERE id = ?').run(JSON.stringify(p), id)
    return textoPropuesta(id, p, personas, mon)
  }

  getDb().prepare('DELETE FROM wa_pendientes WHERE id = ?').run(id)
  if (accion === 'x') return { texto: 'Listo, no guardé nada.' }

  const pagado = p.pagado || accion === 'gp'
  let pagoId = p.pagoId
  // "Sumar al mes": se suma al monto que tenga en este momento (por si cambió desde la propuesta)
  if (accion === 's' && pagoId) {
    const actual = getDb().prepare('SELECT monto FROM pagos WHERE id = ?').get(pagoId) as { monto: number } | undefined
    p.monto = Math.round(((actual?.monto ?? 0) + p.monto) * 100) / 100
  }
  if (pagoId) {
    actualizarPago(pagoId, { monto: p.monto, ...(p.manual && { asignadoA: p.asignadoA }), ...(pagado && { pagado: true }) })
  } else {
    pagoId = crearPago({
      conceptoId: p.conceptoId, nombre: p.nombre, categoria: p.categoria, tipo: p.tipo, anio: p.anio, mes: p.mes,
      monto: p.monto, asignadoA: p.asignadoA, pagado, asignacionManual: p.manual,
    })
  }

  // La asignación automática puede haber reacomodado el mes: informamos lo que quedó guardado
  const estado = getEstadoMes(p.anio, p.mes)
  const guardado = estado.filas.find(f => f.pago?.id === pagoId)?.pago
  const total = estado.filas.reduce((s, f) => s + (f.pago?.monto ?? 0), 0)
  return {
    texto: [
      `✓ Guardado: *${p.nombre}* ${dinero(p.monto, mon)}${pagado ? ' · pagado' : ''}`,
      `Le toca: *${quienTxt(guardado?.asignadoA ?? p.asignadoA, personas)}*`,
      `Total de ${MESES[p.mes - 1].toLowerCase()}: ${dinero(total, mon)}`,
    ].join('\n'),
  }
}

function marcarPagado(escrito: string, anio: number, mes: number): Respuesta {
  const estado = getEstadoMes(anio, mes)
  const fila = mejorCoincidencia(escrito, estado.filas.filter(f => !f.pago?.pagado))
  const mon = estado.config.monedaBase
  if (!fila) {
    const yaPagado = mejorCoincidencia(escrito, estado.filas)
    return { texto: yaPagado ? `*${yaPagado.nombre}* ya estaba pagado.` : `No encontré "${escrito}" en ${MESES[mes - 1].toLowerCase()}. Escribe *pendientes* para ver la lista.` }
  }
  if (fila.pago) {
    actualizarPago(fila.pago.id, { pagado: true })
    return { texto: `✓ *${fila.nombre}* marcado como pagado (${dinero(fila.pago.monto, mon)}).` }
  }
  if (fila.montoSugerido == null) return { texto: `Primero dime el monto, por ejemplo: *${fila.nombre.toLowerCase()} 186 pagado*` }
  crearPago({
    conceptoId: fila.concepto?.id, nombre: fila.nombre, categoria: fila.categoria, tipo: fila.tipo, anio, mes,
    monto: fila.montoSugerido, asignadoA: fila.asignacionSugerida ?? fila.concepto?.asignadoDefault ?? 'ambos', pagado: true,
  })
  return { texto: `✓ *${fila.nombre}* registrado y pagado con el monto de referencia (${dinero(fila.montoSugerido, mon)}). Si fue otro monto, escríbeme: *${fila.nombre.toLowerCase()} <monto>*` }
}

function resumen(anio: number, mes: number, personas: [Persona, Persona]): Respuesta {
  const e = getEstadoMes(anio, mes)
  const mon = e.config.monedaBase
  let total = 0, a = 0, b = 0, pagado = 0
  for (const f of e.filas) if (f.pago) {
    const [x, y] = dividir(f.pago.monto, f.pago.asignadoA, e.porcentaje1)
    total += f.pago.monto; a += x; b += y
    if (f.pago.pagado) pagado += f.pago.monto
  }
  const faltan = e.filas.filter(f => !f.pago?.pagado).length
  return {
    texto: [
      `*${MESES[mes - 1]} ${anio}*`,
      `Total: *${dinero(total, mon)}* · pagado ${dinero(pagado, mon)}`,
      `${corto(personas[0])}: ${dinero(a, mon)} (${total ? ((a / total) * 100).toFixed(0) : 0}%)`,
      `${corto(personas[1])}: ${dinero(b, mon)} (${total ? ((b / total) * 100).toFixed(0) : 0}%)`,
      faltan ? `Faltan ${faltan} por pagar. Escribe *pendientes* para verlos.` : 'Todo pagado este mes ✓',
    ].join('\n'),
  }
}

function pendientes(anio: number, mes: number, personas: [Persona, Persona]): Respuesta {
  const e = getEstadoMes(anio, mes)
  const mon = e.config.monedaBase
  const orden = { vencido: 0, 'por-vencer': 1, pendiente: 2, 'sin-registrar': 3, pagado: 4 }
  const lista = e.filas.filter(f => !f.pago?.pagado)
    .sort((x, y) => orden[estadoFila(x, anio, mes)] - orden[estadoFila(y, anio, mes)])
  if (!lista.length) return { texto: `Todo pagado en ${MESES[mes - 1].toLowerCase()} ✓` }
  const linea = (f: FilaMes) => {
    const est = estadoFila(f, anio, mes)
    const marca = est === 'vencido' ? '🔴' : est === 'por-vencer' ? '🟡' : '⚪'
    const monto = f.pago?.monto ?? f.montoSugerido
    const quien = f.pago?.asignadoA ?? f.asignacionSugerida ?? f.concepto?.asignadoDefault ?? 'ambos'
    return `${marca} ${f.nombre}: ${monto != null ? dinero(monto, mon) : 'sin monto'}${f.diaVencimiento ? ` · día ${f.diaVencimiento}` : ''} · ${quienTxt(quien, personas)}`
  }
  return { texto: [`*Por pagar en ${MESES[mes - 1].toLowerCase()}* (${lista.length})`, ...lista.slice(0, 20).map(linea)].join('\n') }
}

const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
