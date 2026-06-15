export interface Persona {
  nombre: string
  salario: number   // anual, en la moneda propia de la persona
  moneda: string
  email?: string
  notificaciones?: boolean
  foto?: string     // base64 data URL, redimensionada a 200×200
}

export interface Configuracion {
  persona1: Persona
  persona2: Persona
  moneda: string    // moneda base para mostrar y calcular proporciones
  tipoCambio: number // 1 unidad de moneda extranjera = tipoCambio unidades de moneda base
}

export interface TipoGasto {
  id: string
  nombre: string
  descripcion: string
  activo: boolean
}

export type TipoPeriodicidad = 'mensual' | 'bimestral' | 'trimestral' | 'semestral' | 'anual'

export interface GastoTransversal {
  id: string
  nombre: string
  monto: number
  periodicidad: TipoPeriodicidad
  fechaInicio: string
  fechaFin: string | null
  activo: boolean
  notas: string
}

export type CategoriaServicio =
  | 'electricidad' | 'agua' | 'gas' | 'internet' | 'telefono' | 'streaming'
  | 'hipoteca' | 'asistente_hogar' | 'vigilancia' | 'nana' | 'seguridad_vecinal'
  | 'alimentos' | 'seguro_vehicular' | 'kinder' | 'otro'
export type TipoGastoServicio = 'fijo' | 'variable'
export type PeriodicidadServicio = 'mensual' | 'anual' | 'personalizado'

export interface Servicio {
  id: string
  nombre: string
  categoria: CategoriaServicio
  tipoGasto: TipoGastoServicio
  montoFijo: number | null      // solo cuando tipoGasto === 'fijo'
  periodicidad: PeriodicidadServicio
  mesInicio: number | null      // 1-12, solo cuando periodicidad === 'personalizado'
  mesFin: number | null         // 1-12
  diaVencimiento: number | null // 1-31
  activo: boolean
  comentario: string
  cuotaDoble: boolean
  mesesCuotaDoble: number[]    // meses (1-12) con cuota doble
}

export interface AsignacionMes {
  id: string
  mes: number
  año: number
  servicioId: string
  servicioNombre: string
  monto: number
  asignadoA: '1' | '2' | 'ambos'
  pagado: boolean
  fechaPago: string | null
}

export interface GastoTransversalMes {
  mes: number
  año: number
  gastoId: string
  gastoNombre: string
  monto: number
  porcentajePersona1: number
  porcionPersona1: number
  porcionPersona2: number
}

export interface GastoUnico {
  id: string
  nombre: string
  categoria: CategoriaServicio
  montoRef: number | null
  comentario: string
}

export interface UsoGastoUnico {
  id: string
  gastoUnicoId: string
  gastoNombre: string
  gastoCate: string
  mes: number
  año: number
  monto: number
  asignadoA: '1' | '2' | 'ambos'
  pagado: boolean
  fechaPago: string | null
}

export type EstadoRecibo = 'pendiente' | 'confirmado' | 'rechazado'
export type MatchTipoRecibo = 'asignacion' | 'gasto_unico' | 'ninguno'

export interface Recibo {
  id: string
  messageId: string | null
  remitente: string | null
  asignadoA: '1' | '2' | 'ambos' | null
  tipoDetectado: string | null
  monto: number | null
  fecha: string | null
  imagenPath: string | null
  estado: EstadoRecibo
  matchTipo: MatchTipoRecibo | null
  matchId: string | null
  confianza: number | null
  rawJson: Record<string, unknown> | null
  creadoEn: string
}

export interface ResumenMes {
  mes: number
  año: number
  persona1: {
    totalServicios: number
    totalTransversales: number
    total: number
  }
  persona2: {
    totalServicios: number
    totalTransversales: number
    total: number
  }
}

export interface PorcentajesSalario {
  porcentaje1: number
  porcentaje2: number
}

// Convierte el salario de cada persona a la moneda base antes de calcular proporciones.
// Si la persona gana en la misma moneda base, no hay conversión.
// Si gana en otra moneda, se multiplica por tipoCambio.
export function calcularPorcentajes(config: Configuracion): PorcentajesSalario {
  const toBase = (salario: number, moneda: string) =>
    moneda === config.moneda ? salario : salario * config.tipoCambio

  const s1 = toBase(config.persona1.salario, config.persona1.moneda)
  const s2 = toBase(config.persona2.salario, config.persona2.moneda)
  const total = s1 + s2
  if (total === 0) return { porcentaje1: 50, porcentaje2: 50 }
  return {
    porcentaje1: (s1 / total) * 100,
    porcentaje2: (s2 / total) * 100,
  }
}
