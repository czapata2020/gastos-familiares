import { google } from 'googleapis'

function getSheets() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON!
  const credentials = JSON.parse(raw)
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] })
  return google.sheets({ version: 'v4', auth })
}

const HOJAS_REQUERIDAS = [
  {
    nombre: 'Config',
    encabezados: ['clave', 'valor'],
    datos: [
      ['persona1_nombre', 'Persona 1'],
      ['persona1_salario', '0'],
      ['persona1_moneda', 'PEN'],
      ['persona2_nombre', 'Persona 2'],
      ['persona2_salario', '0'],
      ['persona2_moneda', 'USD'],
      ['moneda', 'PEN'],
      ['tipo_cambio', '1'],
    ],
  },
  {
    nombre: 'GastosTransversales',
    encabezados: ['id', 'nombre', 'monto', 'periodicidad', 'fechaInicio', 'fechaFin', 'activo', 'notas'],
    datos: [],
  },
  {
    nombre: 'Servicios',
    encabezados: ['id', 'nombre', 'categoria', 'tipoGasto', 'montoFijo', 'periodicidad', 'mesInicio', 'mesFin', 'diaVencimiento', 'activo'],
    datos: [],
  },
  {
    nombre: 'AsignacionesMes',
    encabezados: ['id', 'mes', 'año', 'servicioId', 'servicioNombre', 'monto', 'asignadoA', 'pagado', 'fechaPago'],
    datos: [],
  },
  {
    nombre: 'Historial',
    encabezados: ['id', 'fecha', 'tipo', 'concepto', 'monto', 'asignadoA', 'mes', 'año', 'notas'],
    datos: [],
  },
]

export async function inicializarHojas(spreadsheetId: string): Promise<{ creadas: string[]; existentes: string[] }> {
  const sheets = getSheets()

  const info = await sheets.spreadsheets.get({ spreadsheetId })
  const hojasExistentes = new Set(
    info.data.sheets?.map((s) => s.properties?.title ?? '') ?? []
  )

  const creadas: string[] = []
  const existentes: string[] = []

  for (const hoja of HOJAS_REQUERIDAS) {
    if (hojasExistentes.has(hoja.nombre)) {
      existentes.push(hoja.nombre)
      continue
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: hoja.nombre } } }],
      },
    })

    const filas = [hoja.encabezados, ...hoja.datos]
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${hoja.nombre}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: filas },
    })

    creadas.push(hoja.nombre)
  }

  return { creadas, existentes }
}
