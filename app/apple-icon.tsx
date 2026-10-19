import { ImageResponse } from 'next/og'
import { LOGO_C, LOGO_CHECK, LOGO_FONDO, LOGO_MENTA } from '@/components/Logo'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: LOGO_FONDO }}>
        <svg width="132" height="132" viewBox="0 0 32 32">
          <path d={LOGO_C} fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
          <path d={LOGO_CHECK} fill="none" stroke={LOGO_MENTA} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    size,
  )
}
