/**
 * Marca de Cuentas Claras: una "C" abierta de la que nace un ✓ (cuentas en orden).
 * Los trazos están en una grilla de 32×32; los mismos se usan en los íconos (app/icon.svg, apple-icon, publico/icono).
 */
export const LOGO_C = 'M21.6 9.4A9 9 0 1 0 22.6 21.4'
export const LOGO_CHECK = 'M12.2 16.2l3.1 3.1 9.4-9.6'
export const LOGO_FONDO = '#0f6b5c'
export const LOGO_MENTA = '#9fe3cf'

export function Logo({ size = 32, conFondo = true }: { size?: number; conFondo?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      {conFondo && <rect width="32" height="32" rx="9" fill={LOGO_FONDO} />}
      <path d={LOGO_C} fill="none" stroke={conFondo ? '#fff' : 'currentColor'} strokeWidth="3" strokeLinecap="round" />
      <path d={LOGO_CHECK} fill="none" stroke={conFondo ? LOGO_MENTA : 'rgb(var(--accent))'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Logo con el nombre, para el menú lateral y la página pública. */
export function Marca({ size = 34 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <Logo size={size} />
      <span className="font-display text-[17px] font-bold leading-[1.05] tracking-tight">
        Cuentas<br /><span className="text-accent">Claras</span>
      </span>
    </span>
  )
}
