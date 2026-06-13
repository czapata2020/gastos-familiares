import { NextResponse } from 'next/server'

const DB = process.env.DB_URL ?? 'http://localhost:3001'

export async function POST() {
  try {
    const res = await fetch(`${DB}/api/notificaciones/test`, { method: 'POST' })
    return NextResponse.json(await res.json(), { status: res.status })
  } catch {
    return NextResponse.json({ error: 'DB no disponible' }, { status: 503 })
  }
}
