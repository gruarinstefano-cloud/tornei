'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { Torneo, Squadra, Partita, Campo, StatSquadra } from '@/lib/types'
import { calcolaClassifica } from '@/lib/types'
import Link from 'next/link'

type Tab = 'gironi' | 'risultati' | 'programma' | 'tabellone'

export default function TorneoPage() {
  const { slug } = useParams<{ slug: string }>()
  const [torneo, setTorneo] = useState<Torneo | null>(null)
  const [squadre, setSquadre] = useState<Squadra[]>([])
  const [partite, setPartite] = useState<Partita[]>([])
  const [campi, setCampi] = useState<Campo[]>([])
  const [tab, setTab] = useState<Tab>('gironi')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sb = createClient()
    sb.from('tornei').select('*').eq('slug', slug).single()
      .then(async ({ data: t }) => {
        if (!t) { setLoading(false); return }
        setTorneo(t)
        const [sq, pa, ca] = await Promise.all([
          sb.from('squadre').select('*').eq('torneo_id', t.id),
          sb.from('partite').select('*, squadra_casa:squadre!squadra_casa_id(*), squadra_ospite:squadre!squadra_ospite_id(*), campo:campi(*)').eq('torneo_id', t.id).order('data_ora', { ascending: true }),
          sb.from('campi').select('*').eq('torneo_id', t.id).order('ordine'),
        ])
        setSquadre(sq.data ?? [])
        setPartite((pa.data ?? []) as Partita[])
        setCampi(ca.data ?? [])
        setLoading(false)
      })
  }, [slug])

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"/></div>
  if (!torneo) return <div className="text-center py-20 text-gray-500">Torneo non trovato. <Link href="/" className="text-blue-600">Torna alla lista</Link></div>

  const gironi = Array.from(new Set(squadre.map(s => s.girone).filter(Boolean))) as string[]
  const fasi: Partita['fase'][] = ['quarti','semifinale','finale','terzo_posto']
  const partiteElim = partite.filter(p => fasi.includes(p.fase))
  const giocate = partite.filter(p => p.giocata)
  const daGiocare = partite.filter(p => !p.giocata)

  const primary = torneo.colore_primario || '#1e40af'

  return (
    <div className="min-h-screen" style={{ background: '#f9fafb' }}>
      {/* Banner sponsor */}
      <div className="px-4 py-3" style={{ background: primary + '18', borderBottom: `2px solid ${primary}30` }}>
        <div className="max-w-4xl mx-auto flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
              style={{ background: primary }}>
              {(torneo.nome_societa || torneo.nome).slice(0,2).toUpperCase()}
            </div>
            <div>
              <div className="font-bold text-gray-900 text-lg leading-tight">{torneo.nome_societa || torneo.nome}</div>
              <div className="text-sm text-gray-500">{torneo.nome}</div>
            </div>
          </div>
          {torneo.sponsor?.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {torneo.sponsor.map((s, i) => (
                <span key={i} className="px-3 py-1 bg-white rounded text-sm text-gray-600 border border-gray-200 font-medium">{s}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {([['gironi','Gironi'],['risultati','Risultati'],['programma','Programma'],['tabellone','Tabellone']] as [Tab, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition ${tab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              style={tab===key ? { borderColor: primary, color: primary } : {}}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* GIRONI */}
        {tab === 'gironi' && (
          <div className="grid gap-5 md:grid-cols-2">
            {gironi.map(g => {
              const stats = calcolaClassifica(squadre, partite, g)
              return (
                <div key={g} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100" style={{ background: primary + '10' }}>
                    Girone {g}
                  </div>
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-gray-100">
                      <th className="text-left px-3 py-2 text-xs text-gray-400 font-medium">Squadra</th>
                      <th className="text-center px-1 py-2 text-xs text-gray-400 font-medium">G</th>
                      <th className="text-center px-1 py-2 text-xs text-gray-400 font-medium">V</th>
                      <th className="text-center px-1 py-2 text-xs text-gray-400 font-medium">P</th>
                      <th className="text-center px-1 py-2 text-xs text-gray-400 font-medium">S</th>
                      <th className="text-center px-1 py-2 text-xs text-gray-400 font-medium">GF</th>
                      <th className="text-center px-2 py-2 text-xs text-gray-400 font-medium">Pt</th>
                    </tr></thead>
                    <tbody>
                      {stats.map((s, i) => (
                        <tr key={s.squadra.id} className={i < 2 ? 'bg-blue-50' : ''} style={i < 2 ? { background: primary + '0d' } : {}}>
                          <td className="px-3 py-2 font-medium">
                            <span className="mr-2 text-xs" style={{ color: i < 2 ? primary : '#9ca3af' }}>{i+1}°</span>
                            {s.squadra.nome}
                          </td>
                          <td className="text-center px-1 py-2 text-gray-600">{s.g}</td>
                          <td className="text-center px-1 py-2 text-gray-600">{s.v}</td>
                          <td className="text-center px-1 py-2 text-gray-600">{s.p}</td>
                          <td className="text-center px-1 py-2 text-gray-600">{s.s}</td>
                          <td className="text-center px-1 py-2 text-gray-600">{s.gf}</td>
                          <td className="text-center px-2 py-2 font-bold" style={{ color: primary }}>{s.pt}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })}
          </div>
        )}

        {/* RISULTATI */}
        {tab === 'risultati' && (
          <div className="space-y-5">
            {giocate.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">Partite giocate</div>
                {giocate.map(p => (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
                    <span className="flex-1 text-right text-sm font-medium text-gray-800">{p.squadra_casa?.nome}</span>
                    <span className="px-3 py-1 bg-gray-100 rounded font-bold text-sm min-w-[56px] text-center">{p.gol_casa} – {p.gol_ospite}</span>
                    <span className="flex-1 text-sm font-medium text-gray-800">{p.squadra_ospite?.nome}</span>
                    <span className="text-xs text-gray-400 hidden sm:block">{p.campo?.nome}</span>
                  </div>
                ))}
              </div>
            )}
            {daGiocare.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">Prossime partite</div>
                {daGiocare.map(p => (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
                    <span className="flex-1 text-right text-sm text-gray-700">{p.squadra_casa?.nome}</span>
                    <span className="px-3 py-1 bg-gray-50 border border-gray-200 rounded text-sm min-w-[56px] text-center text-gray-400">vs</span>
                    <span className="flex-1 text-sm text-gray-700">{p.squadra_ospite?.nome}</span>
                    <span className="text-xs text-gray-400 hidden sm:block">
                      {p.data_ora ? new Date(p.data_ora).toLocaleString('it-IT', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '–'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PROGRAMMA PER CAMPO */}
        {tab === 'programma' && (
          <div className="grid gap-5 md:grid-cols-2">
            {campi.map(c => {
              const pCampo = partite.filter(p => p.campo_id === c.id)
              return (
                <div key={c.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 flex items-center gap-2 border-b border-gray-100">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: c.colore }}/>
                    <span className="font-medium text-sm text-gray-800">{c.nome}</span>
                  </div>
                  {pCampo.length === 0
                    ? <div className="px-4 py-4 text-sm text-gray-400">Nessuna partita assegnata</div>
                    : pCampo.map(p => (
                      <div key={p.id} className="px-4 py-3 border-b border-gray-50 last:border-0">
                        <div className="text-xs text-gray-400 mb-1">
                          {p.giocata ? 'Giocata' : p.data_ora ? new Date(p.data_ora).toLocaleTimeString('it-IT', { hour:'2-digit', minute:'2-digit' }) : '–'}
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="flex-1 text-right font-medium">{p.squadra_casa?.nome}</span>
                          <span className="px-2 py-0.5 bg-gray-100 rounded font-bold text-xs">
                            {p.giocata ? `${p.gol_casa}–${p.gol_ospite}` : 'vs'}
                          </span>
                          <span className="flex-1 font-medium">{p.squadra_ospite?.nome}</span>
                        </div>
                      </div>
                    ))
                  }
                </div>
              )
            })}
          </div>
        )}

        {/* TABELLONE */}
        {tab === 'tabellone' && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-4">Prime classificate di ogni girone accedono alla fase eliminatoria</p>
            <div className="flex gap-6 overflow-x-auto pb-2">
              {(['quarti','semifinale','finale'] as const).map(fase => {
                const pf = partiteElim.filter(p => p.fase === fase)
                if (pf.length === 0) return null
                const label = fase === 'quarti' ? 'Quarti' : fase === 'semifinale' ? 'Semifinali' : 'Finale'
                return (
                  <div key={fase} className="flex flex-col gap-3 min-w-[160px]">
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-center">{label}</div>
                    {pf.map(p => (
                      <div key={p.id} className="border border-gray-200 rounded-lg overflow-hidden">
                        {[
                          { sq: p.squadra_casa, gol: p.gol_casa, win: p.giocata && (p.gol_casa ?? 0) > (p.gol_ospite ?? 0) },
                          { sq: p.squadra_ospite, gol: p.gol_ospite, win: p.giocata && (p.gol_ospite ?? 0) > (p.gol_casa ?? 0) }
                        ].map((row, i) => (
                          <div key={i} className={`flex justify-between items-center px-3 py-2 text-sm ${i===0?'border-b border-gray-100':''} ${row.win ? 'font-semibold' : 'text-gray-500'}`}>
                            <span className="truncate">{row.sq?.nome ?? '–'}</span>
                            <span className="ml-2 font-bold">{row.gol ?? ''}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
