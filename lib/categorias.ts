import type { Categoria } from '@/types'

export const CATEGORIAS: { id: Categoria; nombre: string; sigla: string }[] = [
  { id: 'vivienda',        nombre: 'Vivienda',        sigla: 'VI' },
  { id: 'servicios',       nombre: 'Servicios',       sigla: 'SE' },
  { id: 'hogar',           nombre: 'Hogar',           sigla: 'HO' },
  { id: 'alimentos',       nombre: 'Alimentos',       sigla: 'AL' },
  { id: 'educacion',       nombre: 'Educación',       sigla: 'ED' },
  { id: 'salud',           nombre: 'Salud',           sigla: 'SA' },
  { id: 'transporte',      nombre: 'Transporte',      sigla: 'TR' },
  { id: 'seguros',         nombre: 'Seguros',         sigla: 'SG' },
  { id: 'entretenimiento', nombre: 'Entretenimiento', sigla: 'EN' },
  { id: 'deudas',          nombre: 'Deudas',          sigla: 'DE' },
  { id: 'otro',            nombre: 'Otro',            sigla: 'OT' },
]

export const nombreCategoria = (id: string) => CATEGORIAS.find(c => c.id === id)?.nombre ?? 'Otro'

export const MONEDAS = ['PEN', 'USD', 'EUR', 'COP', 'MXN', 'CLP', 'ARS']
