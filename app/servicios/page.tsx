export default function ServiciosPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Servicios del hogar</h1>
      <p className="text-gray-500 mb-8">
        Luz, agua, gas e internet — asignados enteros a cada uno según balance acumulado
      </p>
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
        <p className="text-4xl mb-3">💡</p>
        <p className="font-medium text-gray-600">Próximamente</p>
        <p className="text-sm mt-1">
          Aquí se calculará automáticamente a quién le corresponde pagar cada servicio este mes,
          manteniendo equidad proporcional al salario a lo largo del tiempo.
        </p>
      </div>
    </div>
  )
}
