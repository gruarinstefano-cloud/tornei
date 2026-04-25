'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { Torneo } from '@/lib/types'

export default function DashboardPage() {
  const router = useRouter()
  const [tornei, setTornei] = useState<Torneo[]>([])
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      setUser(user)
      const { data } = await sb.from('tornei').select('*').eq('admin_id', user.id).order('created_at', { ascending: false })
      setTornei(data ?? [])
      setLoading(false)
    })
  }, [])

  async function logout() {
    await createClient().auth.signOut()
    router.push('/')
  }

  async function deleteTorneo(t: Torneo) {
    if (!confirm(`Sei sicuro di voler eliminare "${t.nome}"? Questa azione è irreversibile e cancellerà tutte le squadre, partite e dati del torneo.`)) return
    setDeleting(t.id)
    const sb = createClient()
    const { error } = await sb.from('tornei').delete().eq('id', t.id)
    if (error) { alert('Errore: ' + error.message); setDeleting(null); return }
    setTornei(prev => prev.filter(x => x.id !== t.id))
    setDeleting(null)
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"/>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">I miei tornei</h1>
          <p className="text-gray-500 text-sm">{user?.email}</p>
        </div>
        <div className="flex gap-3">
          <Link href="/admin/torneo/nuovo"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">
            + Nuovo torneo
          </Link>
          <button onClick={logout} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">
            Esci
          </button>
        </div>
      </div>

      {tornei.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-200">
          <p className="text-gray-400 mb-4">Nessun torneo ancora creato</p>
          <Link href="/admin/torneo/nuovo" className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            Crea il primo torneo
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {tornei.map(t => (
            <div key={t.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                style={{ background: t.colore_primario }}>
                {(t.nome_societa || t.nome).slice(0,2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900 truncate">{t.nome}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                    t.stato==='attivo' ? 'bg-green-100 text-green-700' :
                    t.stato==='concluso' ? 'bg-gray-100 text-gray-500' : 'bg-yellow-100 text-yellow-700'}`}>
                    {t.stato==='attivo' ? 'In corso' : t.stato==='concluso' ? 'Concluso' : 'Bozza'}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">/{t.slug}</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Link href={`/torneo/${t.slug}`} target="_blank"
                  className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                  Visualizza
                </Link>
                <Link href={`/admin/torneo/${t.id}`}
                  className="px-3 py-1.5 text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100">
                  Gestisci
                </Link>
                <button onClick={() => deleteTorneo(t)} disabled={deleting === t.id}
                  className="px-3 py-1.5 text-xs bg-red-50 text-red-500 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 transition">
                  {deleting === t.id ? '...' : 'Elimina'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
