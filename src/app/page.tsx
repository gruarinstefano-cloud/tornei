'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function HomePage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isReg, setIsReg] = useState(false)
  const [nome, setNome] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    // Se già loggato, vai alla dashboard
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (user) router.push('/admin/dashboard')
      else setLoading(false)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSubmitting(true)
    const sb = createClient()
    if (isReg) {
      const { error: err } = await sb.auth.signUp({ email, password, options: { data: { nome } } })
      if (err) setError(err.message)
      else { setIsReg(false); setError(''); setSubmitting(false); return }
    } else {
      const { error: err } = await sb.auth.signInWithPassword({ email, password })
      if (err) setError(err.message)
      else { router.push('/admin/dashboard'); return }
    }
    setSubmitting(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"/>
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center text-white font-bold text-2xl mb-4 shadow-lg">
            T
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Tornei di Calcio</h1>
          <p className="text-gray-500 text-sm mt-1">Area amministratori</p>
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
            {error && (
              <p className={`text-sm ${error.includes('completata') || error.includes('Registrazione') ? 'text-green-600' : 'text-red-600'}`}>
                {error.includes('completata') ? 'Registrazione completata! Ora accedi.' : error}
              </p>
            )}
            <button type="submit" disabled={submitting}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50 transition">
              {submitting ? 'Caricamento...' : isReg ? 'Registrati' : 'Accedi'}
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
