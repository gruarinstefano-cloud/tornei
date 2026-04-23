'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isReg, setIsReg] = useState(false)
  const [nome, setNome] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    const sb = createClient()
    if (isReg) {
      const { error: err } = await sb.auth.signUp({ email, password, options: { data: { nome } } })
      if (err) setError(err.message)
      else { setError(''); setIsReg(false); setError('Registrazione completata! Ora accedi.') }
    } else {
      const { error: err } = await sb.auth.signInWithPassword({ email, password })
      if (err) setError(err.message)
      else router.push('/admin/dashboard')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded-full mx-auto flex items-center justify-center text-white font-bold text-xl mb-3">T</div>
          <h1 className="text-2xl font-bold text-gray-900">Area Admin</h1>
          <p className="text-gray-500 text-sm mt-1">Gestione tornei di calcio</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            {isReg && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input type="text" value={nome} onChange={e => setNome(e.target.value)} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>
            {error && <p className={`text-sm ${error.includes('completata') ? 'text-green-600' : 'text-red-600'}`}>{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50 transition">
              {loading ? 'Caricamento...' : isReg ? 'Registrati' : 'Accedi'}
            </button>
          </form>
          <p className="text-center text-sm text-gray-500 mt-4">
            {isReg ? 'Hai già un account?' : 'Nuovo admin?'}{' '}
            <button onClick={() => { setIsReg(!isReg); setError('') }} className="text-blue-600 font-medium">
              {isReg ? 'Accedi' : 'Registrati'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
