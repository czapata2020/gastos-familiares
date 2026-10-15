export type PersonaId = '1' | '2'
export type Asignacion = PersonaId | 'ambos'
export type TipoConcepto = 'fijo' | 'variable' | 'ocasional'

export type Categoria =
  | 'vivienda' | 'servicios' | 'hogar' | 'alimentos' | 'educacion' | 'salud'
  | 'transporte' | 'seguros' | 'entretenimiento' | 'deudas' | 'otro'

export interface Persona {
  id: PersonaId
  nombre: string
  email: string
}

/** Salarios vigentes desde un mes (YYYY-MM). El último periodo con desde <= mes aplica. */
export interface Reparto {
  id: string
  desde: string
  salario1: number
  moneda1: string
  salario2: number
  moneda2: string
  /** 1 unidad de moneda extranjera = tipoCambio unidades de moneda base */
  tipoCambio: number
  /** Si se define, ignora salarios y usa este % para la persona 1 (0-100). */
  porcentajeManual: number | null
}

export interface Concepto {
  id: string
  nombre: string
  categoria: Categoria
  tipo: TipoConcepto
  montoRef: number | null
  asignadoDefault: Asignacion
  diaVencimiento: number | null
  /** Meses (1-12) en que aplica. Vacío = todos. */
  mesesActivos: number[]
  /** Meses (1-12) en que el monto de referencia se duplica. */
  mesesCuotaDoble: number[]
  nota: string
  activo: boolean
}

export interface Pago {
  id: string
  conceptoId: string | null
  nombre: string
  categoria: Categoria
  tipo: TipoConcepto
  anio: number
  mes: number
  monto: number
  asignadoA: Asignacion
  pagado: boolean
  fechaPago: string | null
  nota: string
}

export interface Config {
  monedaBase: string
}

/** Fila del mes: un pago registrado o un concepto recurrente aún sin registrar. */
export interface FilaMes {
  key: string
  pago: Pago | null
  concepto: Concepto | null
  nombre: string
  categoria: Categoria
  tipo: TipoConcepto
  montoSugerido: number | null
  esCuotaDoble: boolean
  diaVencimiento: number | null
}

export interface EstadoMes {
  anio: number
  mes: number
  config: Config
  personas: [Persona, Persona]
  porcentaje1: number
  filas: FilaMes[]
  ocasionales: Concepto[]
}
