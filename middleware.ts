import { NextRequest, NextResponse } from 'next/server'
import { createRemoteJWKSet, jwtVerify } from 'jose'

/**
 * Cloudflare Access hace el login (código por correo) antes de que el pedido llegue aquí.
 * Igual verificamos el JWT que Access firma, por si alguien llegara a la app sin pasar por Cloudflare.
 *
 *   CF_ACCESS_TEAM_DOMAIN  ej. gastos-familiares.cloudflareaccess.com
 *   CF_ACCESS_AUD          "Application Audience (AUD) Tag" de la aplicación en Access
 *   ALLOWED_EMAILS         correos permitidos, separados por coma (segunda barrera)
 *   DEV_USER_EMAIL         solo fuera de producción: usuario simulado sin Cloudflare
 */
const TEAM = process.env.CF_ACCESS_TEAM_DOMAIN
const AUD = process.env.CF_ACCESS_AUD
const ALLOWED = (process.env.ALLOWED_EMAILS ?? '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
const JWKS = TEAM ? createRemoteJWKSet(new URL(`https://${TEAM}/cdn-cgi/access/certs`)) : null

function denegar(msg: string) {
  return new NextResponse(msg, { status: 403, headers: { 'content-type': 'text/plain; charset=utf-8' } })
}

function seguir(req: NextRequest, email: string) {
  const headers = new Headers(req.headers)
  headers.set('x-user-email', email)
  return NextResponse.next({ request: { headers } })
}

export async function middleware(req: NextRequest) {
  if (!JWKS || !AUD) {
    if (process.env.NODE_ENV !== 'production') return seguir(req, process.env.DEV_USER_EMAIL ?? ALLOWED[0] ?? 'dev@local')
    return denegar('Falta configurar CF_ACCESS_TEAM_DOMAIN y CF_ACCESS_AUD.')
  }

  const token = req.headers.get('cf-access-jwt-assertion') ?? req.cookies.get('CF_Authorization')?.value
  if (!token) return denegar('Acceso solo a través de Cloudflare Access.')

  try {
    const { payload } = await jwtVerify(token, JWKS, { issuer: `https://${TEAM}`, audience: AUD })
    const email = String(payload.email ?? '').toLowerCase()
    if (!email || (ALLOWED.length && !ALLOWED.includes(email))) return denegar(`${email || 'Este usuario'} no tiene acceso.`)
    return seguir(req, email)
  } catch {
    return denegar('Sesión de Cloudflare Access inválida o vencida. Recarga la página.')
  }
}

export const config = {
  // api/whatsapp/webhook queda fuera: lo llama Meta y se valida con la firma HMAC del App Secret
  matcher: ['/((?!api/health|api/whatsapp/webhook|_next/static|_next/image|icon|apple-icon|manifest.webmanifest).*)'],
}
