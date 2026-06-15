import { NextRequest, NextResponse } from 'next/server'

const DB = process.env.DB_URL ?? 'http://localhost:3001'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const res = await fetch(`${DB}/api/recibos/${id}/imagen`)
    if (!res.ok) return NextResponse.json({ error: 'No encontrada' }, { status: res.status })
    const blob = await res.blob()
    return new NextResponse(blob.stream(), {
      headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'image/jpeg' },
    })
  } catch {
    return NextResponse.json({ error: 'DB no disponible' }, { status: 503 })
  }
}
