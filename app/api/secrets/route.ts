import { NextRequest, NextResponse } from 'next/server'

const DB_URL = process.env.DB_URL || 'http://localhost:3001'

export async function GET() {
  const res = await fetch(`${DB_URL}/api/secrets/smtp`)
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const res = await fetch(`${DB_URL}/api/secrets/smtp`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
