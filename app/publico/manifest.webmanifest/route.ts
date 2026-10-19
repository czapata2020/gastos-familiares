/** Manifiesto de la app (nombre, colores, íconos) en ruta pública: el celular lo lee sin sesión al instalarla. */
export function GET() {
  return Response.json({
    name: 'Cuentas Claras',
    short_name: 'Cuentas Claras',
    description: 'Los gastos del hogar, repartidos según el ingreso de cada uno',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0c1110',
    theme_color: '#0f6b5c',
    icons: [
      { src: '/publico/icono?tam=192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/publico/icono?tam=512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/publico/icono?tam=512&margen=1', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }, { headers: { 'content-type': 'application/manifest+json', 'cache-control': 'public, max-age=3600' } })
}
