import { NextResponse } from 'next/server'
import { validarConexion } from '@/lib/google-sheets'

export async function GET() {
  const result = await validarConexion()
  if (result.ok) {
    return NextResponse.json({ ok: true, titulo: result.titulo })
  }
  return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
}
