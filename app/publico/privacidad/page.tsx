import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Política de privacidad · Cuentas Claras' }

const ACTUALIZADO = '16 de octubre de 2026'
const CONTACTO = 'cesarzapata24@gmail.com'

/** Página pública (sin login): la exige Meta para publicar la app de WhatsApp. */
export default function Privacidad() {
  return (
    <article className="mx-auto grid max-w-2xl gap-5 py-6 text-[15px] leading-relaxed text-ink-2">
      <header className="grid gap-1">
        <p className="text-xs font-bold uppercase tracking-wider text-accent">Cuentas Claras</p>
        <h1 className="font-display text-3xl font-bold text-ink">Política de privacidad</h1>
        <p className="text-sm text-ink-3">Última actualización: {ACTUALIZADO}</p>
      </header>

      <p>Cuentas Claras es una aplicación privada de uso familiar para registrar los gastos de un hogar y repartirlos entre sus integrantes. No es un servicio abierto al público: solo pueden usarla las personas autorizadas por el hogar.</p>

      <section className="grid gap-2">
        <h2 className="font-display text-lg font-bold text-ink">Qué datos usamos</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Nombre, correo y número de WhatsApp de las personas autorizadas.</li>
          <li>Los gastos que ellas registran: concepto, monto, mes, quién lo paga y notas.</li>
          <li>Los mensajes que envían al número de WhatsApp de Cuentas Claras, solo para entender y registrar esos gastos.</li>
        </ul>
      </section>

      <section className="grid gap-2">
        <h2 className="font-display text-lg font-bold text-ink">Para qué los usamos</h2>
        <p>Únicamente para registrar gastos, calcular cuánto le corresponde a cada persona, mostrar resúmenes y enviar recordatorios de vencimiento. No usamos los datos para publicidad ni los vendemos o compartimos con terceros. Los mensajes de WhatsApp se transmiten a través de la plataforma de Meta (WhatsApp Business), sujeta a sus propias políticas.</p>
      </section>

      <section className="grid gap-2">
        <h2 className="font-display text-lg font-bold text-ink">Dónde se guardan</h2>
        <p>En un servidor privado protegido con acceso restringido. Solo las personas autorizadas pueden ver la información, después de verificar su correo.</p>
      </section>

      <section id="eliminar" className="grid gap-2">
        <h2 className="font-display text-lg font-bold text-ink">Eliminación de datos</h2>
        <p>Cualquier persona puede pedir que se borren sus datos y los mensajes asociados escribiendo a <b className="text-ink">{CONTACTO}</b>. La solicitud se atiende en un plazo máximo de 30 días.</p>
      </section>

      <section className="grid gap-2">
        <h2 className="font-display text-lg font-bold text-ink">Contacto</h2>
        <p>{CONTACTO}</p>
      </section>
    </article>
  )
}
