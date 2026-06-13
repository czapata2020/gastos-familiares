import { google } from 'googleapis'
import type { Configuracion, GastoTransversal, Servicio, CategoriaServicio, TipoGastoServicio, PeriodicidadServicio, AsignacionMes } from '@/types'

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON no está configurado en .env.local')
  const credentials = JSON.parse(raw)
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

function getSheets() {
  return google.sheets({ version: 'v4', auth: getAuth() })
}

function getSpreadsheetId() {
  const id = process.env.GOOGLE_SPREADSHEET_ID
  if (!id) throw new Error('GOOGLE_SPREADSHEET_ID no está configurado en .env.local')
  return id
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export async function readRange(range: string): Promise<string[][]> {
  const sheets = getSheets()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range,
  })
  return (res.data.values as string[][]) ?? []
}

export async function writeRange(range: string, values: (string | number | boolean | null)[][]): Promise<void> {
  const sheets = getSheets()
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSpreadsheetId(),
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  })
}

export async function appendRows(sheetName: string, values: (string | number | boolean | null)[][]): Promise<void> {
  const sheets = getSheets()
  await sheets.spreadsheets.values.append({
    spreadsheetId: getSpreadsheetId(),
    range: `${sheetName}!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  })
}

export async function clearRange(range: string): Promise<void> {
  const sheets = getSheets()
  await sheets.spreadsheets.values.clear({
    spreadsheetId: getSpreadsheetId(),
    range,
  })
}

// ─── Configuración ──────────────────────────────────────────────────────────

export async function getConfiguracion(): Promise<Configuracion> {
  const rows = await readRange('Config!A:B')
  const map: Record<string, string> = {}
  for (const [key, value] of rows) {
    if (key) map[key] = value ?? ''
  }
  return {
    persona1: {
      nombre: map['persona1_nombre'] ?? 'Persona 1',
      salario: parseFloat(map['persona1_salario'] ?? '0'),
      moneda: map['persona1_moneda'] ?? 'PEN',
    },
    persona2: {
      nombre: map['persona2_nombre'] ?? 'Persona 2',
      salario: parseFloat(map['persona2_salario'] ?? '0'),
      moneda: map['persona2_moneda'] ?? 'USD',
    },
    moneda: map['moneda'] ?? 'PEN',
    tipoCambio: parseFloat(map['tipo_cambio'] ?? '1'),
  }
}

export async function saveConfiguracion(config: Configuracion): Promise<void> {
  const values = [
    ['persona1_nombre', config.persona1.nombre],
    ['persona1_salario', config.persona1.salario],
    ['persona1_moneda', config.persona1.moneda],
    ['persona2_nombre', config.persona2.nombre],
    ['persona2_salario', config.persona2.salario],
    ['persona2_moneda', config.persona2.moneda],
    ['moneda', config.moneda],
    ['tipo_cambio', config.tipoCambio],
  ]
  await clearRange('Config!A:B')
  await appendRows('Config', values)
}

// ─── Gastos Transversales ────────────────────────────────────────────────────

export async function getGastosTransversales(): Promise<GastoTransversal[]> {
  const rows = await readRange('GastosTransversales!A:H')
  if (rows.length <= 1) return []
  return rows.slice(1).map(([id, nombre, monto, periodicidad, fechaInicio, fechaFin, activo, notas]) => ({
    id,
    nombre,
    monto: parseFloat(monto ?? '0'),
    periodicidad: periodicidad as GastoTransversal['periodicidad'],
    fechaInicio,
    fechaFin: fechaFin || null,
    activo: activo === 'TRUE' || activo === 'true' || activo === '1',
    notas: notas ?? '',
  }))
}

export async function saveGastoTransversal(gasto: GastoTransversal): Promise<void> {
  await appendRows('GastosTransversales', [[
    gasto.id,
    gasto.nombre,
    gasto.monto,
    gasto.periodicidad,
    gasto.fechaInicio,
    gasto.fechaFin ?? '',
    gasto.activo ? 'TRUE' : 'FALSE',
    gasto.notas,
  ]])
}

// ─── Servicios ───────────────────────────────────────────────────────────────

export async function getServicios(): Promise<Servicio[]> {
  const rows = await readRange('Servicios!A:J')
  if (rows.length <= 1) return []
  return rows.slice(1)
    .filter(([, , , , , , , , , activo]) => activo !== 'FALSE')
    .map(([id, nombre, categoria, tipoGasto, montoFijo, periodicidad, mesInicio, mesFin, diaVencimiento]) => ({
      id,
      nombre,
      categoria: (categoria as CategoriaServicio) ?? 'otro',
      tipoGasto: (tipoGasto as TipoGastoServicio) ?? 'variable',
      montoFijo: montoFijo ? parseFloat(montoFijo) : null,
      periodicidad: (periodicidad as PeriodicidadServicio) ?? 'mensual',
      mesInicio: mesInicio ? parseInt(mesInicio) : null,
      mesFin: mesFin ? parseInt(mesFin) : null,
      diaVencimiento: diaVencimiento ? parseInt(diaVencimiento) : null,
      activo: true,
    }))
}

export async function saveServicio(servicio: Servicio): Promise<void> {
  await appendRows('Servicios', [[
    servicio.id,
    servicio.nombre,
    servicio.categoria,
    servicio.tipoGasto,
    servicio.montoFijo ?? '',
    servicio.periodicidad,
    servicio.mesInicio ?? '',
    servicio.mesFin ?? '',
    servicio.diaVencimiento ?? '',
    'TRUE',
  ]])
}

export async function updateServicio(servicio: Servicio): Promise<void> {
  const rows = await readRange('Servicios!A:J')
  if (rows.length <= 1) return
  const [encabezados, ...datos] = rows
  const actualizadas = datos.map((row) =>
    row[0] === servicio.id
      ? [servicio.id, servicio.nombre, servicio.categoria, servicio.tipoGasto,
         servicio.montoFijo ?? '', servicio.periodicidad, servicio.mesInicio ?? '',
         servicio.mesFin ?? '', servicio.diaVencimiento ?? '', 'TRUE']
      : row
  )
  await clearRange('Servicios!A:J')
  await writeRange('Servicios!A1', [encabezados, ...actualizadas])
}

export async function deleteServicio(id: string): Promise<void> {
  const rows = await readRange('Servicios!A:J')
  if (rows.length <= 1) return
  const [encabezados, ...datos] = rows
  const restantes = datos.filter(([rowId]) => rowId !== id)
  await clearRange('Servicios!A:J')
  await writeRange('Servicios!A1', [encabezados, ...restantes])
}

// ─── Asignaciones del mes ────────────────────────────────────────────────────

export async function getAsignacionesMes(mes: number, año: number): Promise<AsignacionMes[]> {
  const rows = await readRange('AsignacionesMes!A:J')
  if (rows.length <= 1) return []
  return rows
    .slice(1)
    .filter(([, m, a]) => parseInt(m) === mes && parseInt(a) === año)
    .map(([id, m, a, servicioId, servicioNombre, monto, asignadoA, pagado, fechaPago]) => ({
      mes: parseInt(m),
      año: parseInt(a),
      servicioId,
      servicioNombre,
      monto: parseFloat(monto ?? '0'),
      asignadoA: asignadoA as '1' | '2',
      pagado: pagado === 'TRUE' || pagado === 'true',
      fechaPago: fechaPago || null,
    }))
}

export async function saveAsignacionMes(asignacion: AsignacionMes & { id: string }): Promise<void> {
  await appendRows('AsignacionesMes', [[
    asignacion.id,
    asignacion.mes,
    asignacion.año,
    asignacion.servicioId,
    asignacion.servicioNombre,
    asignacion.monto,
    asignacion.asignadoA,
    asignacion.pagado ? 'TRUE' : 'FALSE',
    asignacion.fechaPago ?? '',
  ]])
}

// ─── Validar conexión ─────────────────────────────────────────────────────────

export async function validarConexion(): Promise<{ ok: boolean; titulo?: string; error?: string }> {
  try {
    const sheets = getSheets()
    const res = await sheets.spreadsheets.get({ spreadsheetId: getSpreadsheetId() })
    return { ok: true, titulo: res.data.properties?.title ?? 'Sin título' }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return { ok: false, error: message }
  }
}
