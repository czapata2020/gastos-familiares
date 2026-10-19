import { ImageResponse } from 'next/og'
import { LOGO_C, LOGO_CHECK, LOGO_FONDO, LOGO_MENTA } from '@/components/Logo'

/** Ícono 1024×1024 para la app de Meta (público). */
export function GET() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: LOGO_FONDO }}>
        <svg width="760" height="760" viewBox="0 0 32 32">
          <path d={LOGO_C} fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
          <path d={LOGO_CHECK} fill="none" stroke={LOGO_MENTA} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    { width: 1024, height: 1024 },
  )
}
