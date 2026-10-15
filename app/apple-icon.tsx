import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f6b5c' }}>
        <svg width="120" height="120" viewBox="0 0 32 32">
          <path d="M9 21.5V12a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v9.5M16 10v13.5M9 23.5h14" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        </svg>
      </div>
    ),
    size,
  )
}
