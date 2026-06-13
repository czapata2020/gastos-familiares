import { NextResponse } from 'next/server'
import { inicializarHojas } from '@/lib/sheets-setup'

export async function POST() {
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID
  if (!spreadsheetId) {
    return NextResponse.json({ error: 'GOOGLE_SPREADSHEET_ID no configurado' }, { status: 400 })
  }
  try {
    const resultado = await inicializarHojas(spreadsheetId)
    return NextResponse.json(resultado)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
