import { signIn } from '@/auth'
import { Wallet } from 'lucide-react'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div className="min-h-screen flex items-center justify-center bg-ash px-4">
      <div className="bg-white rounded-2xl shadow-sm p-10 w-full max-w-sm text-center">
        <Wallet className="w-8 h-8 text-brand-500 mx-auto mb-3" strokeWidth={1.8} />
        <h1 className="text-lg font-semibold text-gray-900 mb-1">Gastos Familiares</h1>
        <p className="text-sm text-sage mb-6">Inicia sesión para continuar</p>

        {error && (
          <p className="text-sm text-terracotta-500 mb-4">
            Esta cuenta no tiene acceso a la aplicación.
          </p>
        )}

        <form
          action={async () => {
            'use server'
            await signIn('google', { redirectTo: '/' })
          }}
        >
          <button
            type="submit"
            className="w-full rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Continuar con Google
          </button>
        </form>
      </div>
    </div>
  )
}
