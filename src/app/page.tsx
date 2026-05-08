'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { Torneo } from '@/lib/types'

export default function HomePage() {
  const [tornei, setTornei] = useState<Torneo[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'tutti' | 'attivo' | 'concluso'>('tutti')

  useEffect(() => {
    const sb = createClient()
    sb.from('tornei').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setTornei(data ?? []); setLoading(false) })
  }, [])

  const filtrati = tornei.filter(t => filtro === 'tutti' || t.stato === filtro)

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Tornei di Calcio</h1>
        <p className="text-gray-500 mt-1">Segui i tuoi tornei preferiti in tempo reale</p>
      </div>

      <div className="flex gap-2 mb-6">
        {(['tutti','attivo','concluso'] as const).map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition ${filtro===f ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'}`}>
            {f === 'tutti' ? 'Tutti' : f === 'attivo' ? 'In corso' : 'Conclusi'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1,2,3,4].map(i => <div key={i} className="h-32 bg-gray-200 rounded-xl animate-pulse"/>)}
        </div>
      ) : filtrati.length === 0 ? (
        <div className="text-center py-20 text-gray-400">Nessun torneo trovato</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtrati.map(t => (
            <Link key={t.id} href={`/torneo/${t.slug}`}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition block">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                  style={{ background: t.colore_primario }}>
                  {(t.nome_societa || t.nome).slice(0,2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h2 className="font-semibold text-gray-900 truncate">{t.nome}</h2>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                      t.stato === 'attivo' ? 'bg-green-100 text-green-700' :
                      t.stato === 'concluso' ? 'bg-gray-100 text-gray-500' :
                      'bg-yellow-100 text-yellow-700'}`}>
                      {t.stato === 'attivo' ? 'In corso' : t.stato === 'concluso' ? 'Concluso' : 'Bozza'}
                    </span>
                  </div>
                  {t.nome_societa && <p className="text-sm text-gray-500">{t.nome_societa}</p>}
                  <p className="text-xs text-gray-400 mt-1">
                    {t.tipo === 'gironi_eliminazione' ? 'Gironi + Eliminazione' : 'Campionato + Eliminazione'}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-12 text-center">
        <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600">
          Area admin →
        </Link>
      </div>
    </div>
  )
}
