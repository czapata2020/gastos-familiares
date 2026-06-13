import { NextRequest, NextResponse } from 'next/server'

const DB = process.env.DB_URL ?? 'http://localhost:3001'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const res = await fetch(`${DB}/api/usos-gasto-unico/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    return NextResponse.json(await res.json(), { status: res.status })
  } catch {
    return NextResponse.json({ error: 'DB no disponible' }, { status: 503 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const res = await fetch(`${DB}/api/usos-gasto-unico/${id}`, { method: 'DELETE' })
    return NextResponse.json(await res.json(), { status: res.status })
  } catch {
    return NextResponse.json({ error: 'DB no disponible' }, { status: 503 })
  }
}
