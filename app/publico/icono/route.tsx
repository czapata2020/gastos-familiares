import { ImageResponse } from 'next/og'
import { LOGO_C, LOGO_CHECK, LOGO_FONDO, LOGO_MENTA } from '@/components/Logo'

/**
 * Ícono de la app en PNG, público (sin Cloudflare Access): el celular lo descarga sin sesión al crear
 * el acceso directo. /publico/icono?tam=180 · tamaños 16 a 1024 (por defecto 1024, el que pide Meta).
 * ?margen=1 deja aire alrededor (íconos "maskable" de Android, que recortan en círculo).
 */
export function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const tam = Math.min(1024, Math.max(16, Number(sp.get('tam')) || 1024))
  const margen = sp.get('margen') === '1'
  const trazo = Math.round(tam * (margen ? 0.56 : 0.74))
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: LOGO_FONDO }}>
        <svg width={trazo} height={trazo} viewBox="0 0 32 32">
          <path d={LOGO_C} fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
          <path d={LOGO_CHECK} fill="none" stroke={LOGO_MENTA} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    { width: tam, height: tam, headers: { 'cache-control': 'public, max-age=86400' } },
  )
}
