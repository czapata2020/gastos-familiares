import 'server-only'
import ExcelJS from 'exceljs'
import type { Asignacion, Categoria, Concepto, Pago, Persona, TipoConcepto } from '@/types'
import { getDb } from './db'
import { CATEGORIAS } from './categorias'
import { conceptoActivoEnMes, MESES, montoSugerido } from './reparto'
import { crearPago, actualizarPago, getPersonas, listConceptos, listPagos, rebalancearMes } from './repo'
import { leerMonto, mejorCoincidencia, normalizar, puntaje } from './bot/interpretar'

/**
 * Plantilla Excel para cargar o corregir gastos en bloque.
 * Exporta los pagos existentes (con su ID, para actualizarlos) y pre-llena una fila por cada
 * recurrente sin registrar. Al subirla se arma un plan (vista previa) y recién al confirmar se aplica.
 */

const COLUMNAS = ['ID', 'Año', 'Mes', 'Gasto', 'Categoría', 'Monto', 'Quién paga', 'Pagado', 'Nota'] as const
const FILAS_EXTRA = 300  // filas vacías con listas desplegables para agregar gastos

const corto = (p: Persona) => p.nombre.split(' ')[0] || `Persona ${p.id}`

// ── Generar ──────────────────────────────────────────────────────────────────

export async function generarPlantilla(anio: number, desde: number, hasta: number): Promise<Buffer> {
  const personas = getPersonas()
  const conceptos = listConceptos(true)
  const pagos = listPagos(anio).filter(p => p.mes >= desde && p.mes <= hasta)
  const hoy = new Date()
  const mesActual = hoy.getFullYear() * 12 + hoy.getMonth() + 1
  const pasado = (m: number) => anio * 12 + m < mesActual

  const quienDe = (p: Pago) =>
    p.tipo !== 'ocasional' && !p.asignacionManual ? 'Auto'
      : p.asignadoA === 'ambos' ? 'Ambos' : corto(personas[p.asignadoA === '1' ? 0 : 1])

  type Fila = { id: string; mes: number; gasto: string; categoria: string; monto: number | null; quien: string; pagado: string; nota: string; tipo: TipoConcepto }
  const filas: Fila[] = pagos.map(p => ({
    id: p.id, mes: p.mes, gasto: p.nombre, categoria: nombreCat(p.categoria), monto: p.monto, quien: quienDe(p),
    pagado: p.pagado ? 'Sí' : 'No', nota: p.nota, tipo: p.tipo,
  }))
  for (let mes = desde; mes <= hasta; mes++) {
    const registrados = new Set(pagos.filter(p => p.mes === mes).map(p => p.conceptoId))
    for (const c of conceptos) {
      if (!conceptoActivoEnMes(c, anio, mes) || registrados.has(c.id)) continue
      filas.push({
        id: '', mes, gasto: c.nombre, categoria: nombreCat(c.categoria), monto: montoSugerido(c, mes),
        quien: c.asignadoDefault === 'ambos' ? '' : corto(personas[c.asignadoDefault === '1' ? 0 : 1]),
        pagado: pasado(mes) ? 'Sí' : '', nota: '', tipo: c.tipo,
      })
    }
  }
  const orden = { fijo: 0, variable: 1, ocasional: 2 }
  filas.sort((a, b) => a.mes - b.mes || orden[a.tipo] - orden[b.tipo] || a.gasto.localeCompare(b.gasto))

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Cuentas Claras'
  const hoja = wb.addWorksheet('Gastos', { views: [{ state: 'frozen', ySplit: 1 }] })
  hoja.columns = [
    { header: 'ID', key: 'id', width: 13 },
    { header: 'Año', key: 'anio', width: 7 },
    { header: 'Mes', key: 'mes', width: 12 },
    { header: 'Gasto', key: 'gasto', width: 28 },
    { header: 'Categoría', key: 'categoria', width: 16 },
    { header: 'Monto', key: 'monto', width: 13 },
    { header: 'Quién paga', key: 'quien', width: 12 },
    { header: 'Pagado', key: 'pagado', width: 9 },
    { header: 'Nota', key: 'nota', width: 36 },
  ]
  for (const f of filas) {
    hoja.addRow({ id: f.id, anio, mes: MESES[f.mes - 1], gasto: f.gasto, categoria: f.categoria, monto: f.monto ?? undefined, quien: f.quien, pagado: f.pagado, nota: f.nota })
  }

  const encabezado = hoja.getRow(1)
  encabezado.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  encabezado.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F6B5C' } }
  encabezado.alignment = { vertical: 'middle' }
  encabezado.height = 22
  hoja.getColumn('monto').numFmt = '#,##0.00'
  hoja.getColumn('id').font = { color: { argb: 'FF8A9590' } }
  hoja.autoFilter = { from: 'A1', to: 'I1' }

  // Hoja de listas para los desplegables
  const listas = wb.addWorksheet('Listas')
  const nombresGasto = [...new Set(conceptos.filter(c => c.activo).map(c => c.nombre))].sort((a, b) => a.localeCompare(b))
  listas.getColumn(1).values = ['Gastos', ...nombresGasto]
  listas.getColumn(2).values = ['Categorías', ...CATEGORIAS.map(c => c.nombre)]
  listas.getColumn(3).values = ['Meses', ...MESES]
  listas.getColumn(1).width = 28; listas.getColumn(2).width = 18; listas.getColumn(3).width = 12
  listas.getRow(1).font = { bold: true }

  const ultima = filas.length + 1 + FILAS_EXTRA
  const quienes = ['Auto', 'Ambos', corto(personas[0]), corto(personas[1])]
  for (let r = 2; r <= ultima; r++) {
    hoja.getCell(`B${r}`).dataValidation = { type: 'whole', operator: 'between', formulae: [2000, 2100], allowBlank: true }
    hoja.getCell(`C${r}`).dataValidation = { type: 'list', formulae: [`Listas!$C$2:$C$13`], allowBlank: true }
    // Gasto acepta texto libre: un nombre nuevo se crea como gasto ocasional
    hoja.getCell(`D${r}`).dataValidation = {
      type: 'list', formulae: [`Listas!$A$2:$A$${nombresGasto.length + 1}`], allowBlank: true,
      showErrorMessage: false,
    }
    hoja.getCell(`E${r}`).dataValidation = { type: 'list', formulae: [`Listas!$B$2:$B$${CATEGORIAS.length + 1}`], allowBlank: true }
    hoja.getCell(`F${r}`).dataValidation = { type: 'decimal', operator: 'greaterThanOrEqual', formulae: [0], allowBlank: true, showErrorMessage: true, error: 'El monto debe ser un número' }
    hoja.getCell(`G${r}`).dataValidation = { type: 'list', formulae: [`"${quienes.join(',')}"`], allowBlank: true }
    hoja.getCell(`H${r}`).dataValidation = { type: 'list', formulae: ['"Sí,No"'], allowBlank: true }
  }

  const ins = wb.addWorksheet('Instrucciones')
  ins.getColumn(1).width = 110
  const texto = [
    'CÓMO LLENAR ESTA PLANTILLA',
    '',
    `• Viene pre-llenada para ${MESES[desde - 1]}–${MESES[hasta - 1]} ${anio}: los pagos ya registrados y una fila por cada gasto recurrente que falta.`,
    '• Corrige los montos. Si una fila no aplica, bórrala. Si dejas el Monto vacío, esa fila se ignora.',
    '• Para agregar un gasto, usa una fila nueva al final. Si el nombre no existe, se crea como gasto ocasional (elige la Categoría).',
    '• ID: no lo cambies. Identifica pagos que ya existen; al subir la plantilla esos se actualizan en vez de duplicarse.',
    '• Mes: nombre (Enero) o número (1).',
    `• Quién paga: vacío o "Auto" = asignación automática por ingreso (solo recurrentes). "Ambos" = se divide por %. "${quienes[2]}" o "${quienes[3]}" = completo a esa persona.`,
    '• Pagado: Sí o No. Vacío = No.',
    '• Montos con punto decimal (186.50). Sin símbolo de moneda.',
    '',
    'Al subirla en Ajustes → Datos verás una vista previa con lo que se va a crear o actualizar. Nada se guarda hasta que confirmes.',
  ]
  texto.forEach((t, i) => { const c = ins.getCell(`A${i + 1}`); c.value = t; c.alignment = { wrapText: true } })
  ins.getCell('A1').font = { bold: true, size: 13 }

  return Buffer.from(await wb.xlsx.writeBuffer())
}

const nombreCat = (id: string) => CATEGORIAS.find(c => c.id === id)?.nombre ?? 'Otro'

// ── Leer y planificar ────────────────────────────────────────────────────────

export interface FilaPlan {
  fila: number
  accion: 'crear' | 'actualizar'
  pagoId: string | null
  conceptoId: string | null
  nombre: string
  categoria: Categoria
  tipo: TipoConcepto
  anio: number
  mes: number
  monto: number
  /** null = asignación automática */
  asignadoA: Asignacion | null
  pagado: boolean
  nota: string
  aviso: string | null
}

export interface Plan {
  filas: FilaPlan[]
  errores: { fila: number; mensaje: string }[]
  omitidas: number
  resumen: { crear: number; actualizar: number; total: number; meses: string[] }
}

function valor(c: ExcelJS.Cell): string {
  const v = c.value as unknown
  if (v == null) return ''
  if (typeof v === 'object') {
    const o = v as { result?: unknown; richText?: { text: string }[]; text?: string }
    if (o.richText) return o.richText.map(t => t.text).join('').trim()
    if (o.result != null) return String(o.result).trim()
    if (o.text != null) return String(o.text).trim()
    if (v instanceof Date) return v.toISOString()
  }
  return String(v).trim()
}

function leerMes(s: string): number | null {
  const n = Number(s)
  if (Number.isInteger(n) && n >= 1 && n <= 12) return n
  const t = normalizar(s)
  const i = MESES.findIndex(m => normalizar(m) === t || normalizar(m).slice(0, 3) === t.slice(0, 3))
  return t.length >= 3 && i >= 0 ? i + 1 : null
}

export async function planificarImportacion(archivo: ArrayBuffer): Promise<Plan> {
  const wb = new ExcelJS.Workbook()
  try { await wb.xlsx.load(archivo) } catch { throw new Error('No pude leer el archivo. Súbelo como Excel (.xlsx).') }
  const hoja = wb.getWorksheet('Gastos') ?? wb.worksheets[0]
  if (!hoja) throw new Error('El archivo no tiene hojas')

  // Ubicar columnas por encabezado (tolera que las muevan de lugar)
  const col: Record<string, number> = {}
  hoja.getRow(1).eachCell((c, i) => { col[normalizar(valor(c))] = i })
  const req = ['ano', 'mes', 'gasto', 'monto']
  const falta = req.filter(k => !col[k])
  if (falta.length) throw new Error(`Faltan columnas en la hoja: ${falta.join(', ')}. Usa la plantilla descargada.`)
  const get = (r: ExcelJS.Row, k: string) => (col[k] ? valor(r.getCell(col[k])) : '')

  const personas = getPersonas()
  const conceptos = listConceptos(true)
  const cacheAnio = new Map<number, Pago[]>()
  const pagosDe = (a: number) => { if (!cacheAnio.has(a)) cacheAnio.set(a, listPagos(a)); return cacheAnio.get(a)! }
  const porId = (id: string) => getDb().prepare('SELECT id FROM pagos WHERE id = ?').get(id) as { id: string } | undefined

  const filas: FilaPlan[] = []
  const errores: Plan['errores'] = []
  const vistos = new Set<string>()
  let omitidas = 0

  hoja.eachRow({ includeEmpty: false }, (r, n) => {
    if (n === 1) return
    const crudo = { id: get(r, 'id'), anio: get(r, 'ano'), mes: get(r, 'mes'), gasto: get(r, 'gasto'), cat: get(r, 'categoria'),
      monto: get(r, 'monto'), quien: get(r, 'quien paga'), pagado: get(r, 'pagado'), nota: get(r, 'nota') }
    if (!Object.values(crudo).some(Boolean)) return
    const error = (m: string) => errores.push({ fila: n, mensaje: m })

    if (!crudo.monto) { omitidas++; return }
    const anio = Number(crudo.anio)
    if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) return void error(`Año inválido: "${crudo.anio}"`)
    const mes = leerMes(crudo.mes)
    if (!mes) return void error(`Mes inválido: "${crudo.mes}"`)
    if (!crudo.gasto) return void error('Falta el nombre del gasto')
    const monto = leerMonto(crudo.monto.replace(/\s/g, ''))
    if (monto == null) return void error(`Monto inválido: "${crudo.monto}"`)

    const q = normalizar(crudo.quien)
    let asignadoA: Asignacion | null
    if (!q || q === 'auto') asignadoA = null
    else if (q === 'ambos') asignadoA = 'ambos'
    else if (puntaje(q, corto(personas[0])) >= 80 || puntaje(q, personas[0].nombre) >= 80 || q === '1') asignadoA = '1'
    else if (puntaje(q, corto(personas[1])) >= 80 || puntaje(q, personas[1].nombre) >= 80 || q === '2') asignadoA = '2'
    else return void error(`"Quién paga" no reconocido: "${crudo.quien}"`)

    const pg = normalizar(crudo.pagado)
    const pagado = ['si', 's', 'yes', 'x', '1', 'pagado'].includes(pg)
    const nota = crudo.nota.slice(0, 200)

    // 1) Fila exportada con ID → actualizar ese pago
    if (crudo.id) {
      if (!porId(crudo.id)) return void error(`El ID ${crudo.id} no existe (¿plantilla de otra versión?). Bórralo para crearlo como nuevo.`)
      const p = pagosDe(anio).find(x => x.id === crudo.id) ?? null
      if (vistos.has(crudo.id)) return void error(`El ID ${crudo.id} está repetido`)
      vistos.add(crudo.id)
      filas.push({
        fila: n, accion: 'actualizar', pagoId: crudo.id, conceptoId: p?.conceptoId ?? null, nombre: p?.nombre ?? crudo.gasto,
        categoria: p?.categoria ?? 'otro', tipo: p?.tipo ?? 'ocasional', anio, mes, monto,
        asignadoA: p?.tipo === 'ocasional' ? asignadoA ?? p.asignadoA : asignadoA, pagado, nota, aviso: null,
      })
      return
    }

    // 2) Sin ID → buscar el gasto por nombre
    const exacto = conceptos.find(c => normalizar(c.nombre) === normalizar(crudo.gasto))
    const c: Concepto | null = exacto ?? (() => { const m = mejorCoincidencia(crudo.gasto, conceptos); return m && puntaje(crudo.gasto, m.nombre) >= 80 ? m : null })()

    if (c && c.tipo !== 'ocasional') {
      const clave = `${c.id}:${anio}-${mes}`
      if (vistos.has(clave)) return void error(`${c.nombre} aparece dos veces en ${MESES[mes - 1]} ${anio}`)
      vistos.add(clave)
      const existente = pagosDe(anio).find(x => x.conceptoId === c.id && x.mes === mes)
      if (existente) vistos.add(existente.id)
      // La persona configurada como "siempre" para este gasto no es una elección a mano
      const elegido = asignadoA === c.asignadoDefault && c.asignadoDefault !== 'ambos' ? null : asignadoA
      filas.push({
        fila: n, accion: existente ? 'actualizar' : 'crear', pagoId: existente?.id ?? null, conceptoId: c.id, nombre: c.nombre,
        categoria: c.categoria, tipo: c.tipo, anio, mes, monto, asignadoA: elegido, pagado, nota,
        aviso: existente ? 'Ya estaba registrado: se actualiza' : exacto ? null : `Se toma como "${c.nombre}"`,
      })
      return
    }

    const categoria = (CATEGORIAS.find(k => normalizar(k.nombre) === normalizar(crudo.cat) || k.id === normalizar(crudo.cat))?.id ?? c?.categoria ?? 'otro') as Categoria
    filas.push({
      fila: n, accion: 'crear', pagoId: null, conceptoId: c?.id ?? null, nombre: c?.nombre ?? crudo.gasto, categoria,
      tipo: 'ocasional', anio, mes, monto, asignadoA: asignadoA ?? 'ambos', pagado, nota,
      aviso: c ? null : 'Gasto nuevo: se crea como ocasional',
    })
  })

  const meses = [...new Set(filas.map(f => `${f.anio}-${String(f.mes).padStart(2, '0')}`))].sort()
  return {
    filas, errores, omitidas,
    resumen: {
      crear: filas.filter(f => f.accion === 'crear').length,
      actualizar: filas.filter(f => f.accion === 'actualizar').length,
      total: filas.reduce((s, f) => s + f.monto, 0),
      meses: meses.map(k => { const [a, m] = k.split('-'); return `${MESES[Number(m) - 1].slice(0, 3)} ${a}` }),
    },
  }
}

// ── Aplicar ──────────────────────────────────────────────────────────────────

/**
 * Aplica el plan mes por mes en orden cronológico (la asignación automática compensa con los meses
 * anteriores). Los recurrentes se crean primero sin pagar, se reparten y recién después se marcan
 * pagados: un pago marcado como pagado ya no se mueve.
 */
export function aplicarImportacion(plan: Plan): { creados: number; actualizados: number } {
  if (plan.errores.length) throw new Error('Corrige los errores antes de importar')
  const db = getDb()
  const porMes = new Map<string, FilaPlan[]>()
  for (const f of plan.filas) {
    const k = `${f.anio}-${String(f.mes).padStart(2, '0')}`
    porMes.set(k, [...(porMes.get(k) ?? []), f])
  }
  const marcarPagado = db.prepare("UPDATE pagos SET pagado = ?, fecha_pago = CASE WHEN ? = 1 THEN fecha_pago ELSE NULL END, actualizado_en = datetime('now') WHERE id = ?")
  let creados = 0, actualizados = 0

  db.transaction(() => {
    for (const k of [...porMes.keys()].sort()) {
      const filas = porMes.get(k)!
      const [anio, mes] = k.split('-').map(Number)
      const ids: [string, boolean][] = []
      for (const f of filas) {
        if (f.accion === 'actualizar' && f.pagoId) {
          const antes = db.prepare('SELECT pagado FROM pagos WHERE id = ?').get(f.pagoId) as { pagado: number }
          if (antes.pagado === 1 && f.asignadoA == null) {
            // Ya pagado y sin persona indicada: se conserva a quién se asignó (es historia)
            db.prepare("UPDATE pagos SET monto = ?, nota = ?, actualizado_en = datetime('now') WHERE id = ?").run(f.monto, f.nota, f.pagoId)
            ids.push([f.pagoId, f.pagado]); actualizados++
            continue
          }
          // primero sin pagar para que la asignación automática pueda acomodarlo
          db.prepare('UPDATE pagos SET pagado = 0 WHERE id = ?').run(f.pagoId)
          actualizarPago(f.pagoId, {
            monto: f.monto, nota: f.nota,
            ...(f.asignadoA ? { asignadoA: f.asignadoA } : f.tipo !== 'ocasional' ? { automatico: true } : {}),
          })
          ids.push([f.pagoId, f.pagado]); actualizados++
        } else {
          const id = crearPago({
            conceptoId: f.conceptoId, nombre: f.nombre, categoria: f.categoria, tipo: f.tipo, anio, mes, monto: f.monto,
            asignadoA: f.asignadoA ?? 'ambos', asignacionManual: f.asignadoA != null || f.tipo === 'ocasional', nota: f.nota,
          }, false)
          ids.push([id, f.pagado]); creados++
        }
      }
      rebalancearMes(anio, mes)
      for (const [id, pagado] of ids) marcarPagado.run(pagado ? 1 : 0, pagado ? 1 : 0, id)
    }
  })()
  return { creados, actualizados }
}
