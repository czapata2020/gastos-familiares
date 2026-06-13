import { NextRequest, NextResponse } from 'next/server'

const DB = process.env.DB_URL ?? 'http://localhost:3001'

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams.toString()
    const url = `${DB}/api/asignaciones${params ? `?${params}` : ''}`
    const res = await fetch(url)
    return NextResponse.json(await res.json(), { status: res.status })
  } catch {
    return NextResponse.json({ error: 'DB no disponible' }, { status: 503 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const res = await fetch(`${DB}/api/asignaciones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return NextResponse.json(await res.json(), { status: res.status })
  } catch {
    return NextResponse.json({ error: 'DB no disponible' }, { status: 503 })
  }
}
