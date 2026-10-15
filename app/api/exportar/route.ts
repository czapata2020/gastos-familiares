import { exportarCSV } from '@/lib/repo'

export const dynamic = 'force-dynamic'

export function GET() {
  return new Response('﻿' + exportarCSV(), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="gastos-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
