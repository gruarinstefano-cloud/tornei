'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { Torneo, Squadra, Partita, Campo, Sponsor, Giornata, SlotCampo, CalendarioItem, Pausa } from '@/lib/types'
import { calcolaClassifica, calcolaOrariSlot, formatOra, formatDataBreve } from '@/lib/types'
import LogoSquadra from '@/components/LogoSquadra'
import BannerTorneo from '@/components/BannerTorneo'
import Link from 'next/link'

type Tab = 'gironi' | 'risultati' | 'programma' | 'tabellone'

export default function TorneoPage() {
  const { slug } = useParams<{ slug: string }>()
  const [torneo, setTorneo] = useState<Torneo | null>(null)
  const [squadre, setSquadre] = useState<Squadra[]>([])
  const [partite, setPartite] = useState<Partita[]>([])
  const [campi, setCampi] = useState<Campo[]>([])
  const [sponsor, setSponsor] = useState<Sponsor[]>([])
  const [giornate, setGiornate] = useState<Giornata[]>([])
  const [pause, setPause] = useState<Pausa[]>([])
  const [gironiObj, setGironiObj] = useState<any[]>([])
  const [tab, setTab] = useState<Tab>('gironi')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sb = createClient()
    sb.from('tornei').select('*').eq('slug', slug).single()
      .then(async ({ data: t }) => {
        if (!t) { setLoading(false); return }
        setTorneo(t)
        const [sq, pa, ca, sp, gn, gi2, pu] = await Promise.all([
          sb.from('squadre').select('*').eq('torneo_id', t.id),
          sb.from('partite').select('*, squadra_casa:squadre!squadra_casa_id(*), squadra_ospite:squadre!squadra_ospite_id(*), campo:campi(*)').eq('torneo_id', t.id).order('data_ora', { ascending: true, nullsFirst: false }),
          sb.from('campi').select('*').eq('torneo_id', t.id).order('ordine'),
          sb.from('sponsor').select('*').eq('torneo_id', t.id).order('ordine'),
          sb.from('giornate').select('*, slot:slot_campo(*)').eq('torneo_id', t.id).order('data'),
          sb.from('gironi').select('*').eq('torneo_id', t.id).order('ordine'),
          sb.from('pause').select('*').eq('torneo_id', t.id).order('ordine_calendario'),
        ])
        setSquadre(sq.data ?? [])
        setPartite((pa.data ?? []) as Partita[])
        setCampi(ca.data ?? [])
        setSponsor(sp.data ?? [])
        setGiornate((gn as any).data ?? [])
        setGironiObj((gi2 as any).data ?? [])
        setPause((pu as any).data ?? [])
        setLoading(false)
      })
  }, [slug])

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"/>
    </div>
  )
  if (!torneo) return (
    <div className="text-center py-20 text-gray-500">
      Torneo non trovato. <Link href="/" className="text-blue-600">Torna alla lista</Link>
    </div>
  )

  const primary = torneo.colore_primario || '#1e40af'
  const gironiNomi = Array.from(new Set(squadre.map(s => s.girone).filter(Boolean))) as string[]
  const fasi: Partita['fase'][] = ['quarti', 'semifinale', 'finale', 'terzo_posto']
  const isSoloCampionato = torneo.tipo === 'solo_campionato'
  const partiteElim = partite.filter(p => fasi.includes(p.fase))
  const giocate = partite.filter(p => p.giocata && !fasi.includes(p.fase))
  const daGiocare = partite.filter(p => !p.giocata && !fasi.includes(p.fase))
  const primaTabLabel = (torneo.tipo === 'campionato_eliminazione' || torneo.tipo === 'solo_campionato') ? 'Classifica' : 'Gironi'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Banner + Sponsor */}
      <BannerTorneo torneo={torneo} sponsor={sponsor}/>

      {/* Tabs */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {([['gironi', primaTabLabel],['risultati','Risultati'],['programma','Programma'],...(!isSoloCampionato ? [['tabellone','Fase eliminatoria']] : [])] as [Tab,string][]).map(([key,label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition ${tab===key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              style={tab===key ? { borderColor: primary, color: primary } : {}}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* GIRONI / CLASSIFICA */}
        {tab === 'gironi' && (
          <div className="grid gap-5 md:grid-cols-2">
            {(torneo.tipo === 'campionato_eliminazione' || torneo.tipo === 'solo_campionato') && gironiObj.length === 0
              ? (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden md:col-span-2">
                  <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100"
                    style={{ background: primary + '10' }}>
                    Classifica
                  </div>
                  <ClassificaTable stats={calcolaClassifica(squadre, partite)} primary={primary}/>
                </div>
              )
              : (gironiObj.length > 0 ? gironiObj : gironiNomi.map((n: string) => ({ id: n, nome: n }))).map((g: any) => {
                  const stats = gironiObj.length > 0
                    ? calcolaClassifica(squadre, partite, g.id)
                    : calcolaClassifica(squadre.filter((s: any) => s.girone === g.nome), partite)
                  return (
                    <div key={g.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100"
                        style={{ background: primary + '10' }}>
                        Girone {g.nome}
                      </div>
                      <ClassificaTable stats={stats} primary={primary}/>
                    </div>
                  )
                })
            }
          </div>
        )}

        {/* RISULTATI */}
        {tab === 'risultati' && (
          <div className="space-y-5">
            {giocate.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">Partite giocate</div>
                {giocate.map(p => <MatchRow key={p.id} p={p} primary={primary}/>)}
              </div>
            )}
            {daGiocare.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">Prossime partite</div>
                {daGiocare.map(p => <MatchRow key={p.id} p={p} primary={primary} upcoming/>)}
              </div>
            )}
            {giocate.length === 0 && daGiocare.length === 0 && (
              <div className="text-center py-12 text-gray-400">Nessuna partita ancora programmata</div>
            )}
          </div>
        )}

        {/* PROGRAMMA */}
        {tab === 'programma' && (
          <div className="space-y-6">
            {giornate.length === 0 && campi.length === 0 && (
              <div className="text-center py-12 text-gray-400">Nessun programma configurato</div>
            )}
            {(giornate.length > 0 ? giornate : [null]).map(giornata => {
              const gId = giornata?.id ?? null
              return (
                <div key={giornata?.id ?? 'no-date'}>
                  {giornata && (
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-gray-300 inline-block"/>
                      {formatDataBreve(giornata.data)}
                    </h3>
                  )}
                  <div className="grid gap-4 md:grid-cols-2">
                    {campi.map(campo => {
                      const itemsPartite = partite
                        .filter(p => p.campo_id === campo.id && (!gId || p.giornata_id === gId))
                        .sort((a,b) => a.ordine_calendario - b.ordine_calendario)
                        .map(p => ({ kind: 'partita' as const, data: p }))
                      const itemsPause = pause
                        .filter(p => p.campo_id === campo.id && (!gId || p.giornata_id === gId))
                        .sort((a,b) => a.ordine_calendario - b.ordine_calendario)
                        .map(p => ({ kind: 'pausa' as const, data: p }))
                      const allItems: CalendarioItem[] = [...itemsPartite, ...itemsPause]
                        .sort((a,b) => a.data.ordine_calendario - b.data.ordine_calendario)
                      const slotOrario = giornata?.slot?.find(s => s.campo_id === campo.id)?.orario_inizio ?? '09:00'
                      const orariMap = giornata
                        ? calcolaOrariSlot(allItems, giornata.data, slotOrario,
                            (torneo as any).durata_partita_minuti ?? 20,
                            (torneo as any).durata_partita_eliminazione_minuti ?? 20,
                            (torneo as any).tempo_tecnico_minuti ?? 5)
                        : new Map<string, Date>()
                      if (allItems.length === 0) return null
                      return (
                        <div key={campo.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                          <div className="px-4 py-3 flex items-center gap-2 border-b border-gray-100">
                            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: campo.colore }}/>
                            <span className="font-medium text-sm text-gray-800">{campo.nome}</span>
                          </div>
                          {allItems.map(item => {
                            if (item.kind === 'pausa') {
                              if (item.data.tipo === 'separatore') return (
                                <div key={item.data.id} className="flex items-center gap-2 px-4 py-1.5">
                                  <div className="flex-1 border-t border-dashed border-gray-200"/>
                                  <span className="text-xs text-gray-400">{item.data.etichetta}</span>
                                  <div className="flex-1 border-t border-dashed border-gray-200"/>
                                </div>
                              )
                              return (
                                <div key={item.data.id} className="px-4 py-2" style={{ background: item.data.colore+'15' }}>
                                  <span className="text-xs font-medium text-amber-700">{item.data.etichetta} — {item.data.durata_minuti} min</span>
                                </div>
                              )
                            }
                            const p = item.data
                            const orario = orariMap.get(p.id)
                            return (
                              <div key={p.id} className="border-b border-gray-50 last:border-0 px-3 py-3">
                                <div className="flex items-center justify-center gap-2 mb-1.5">
                                  {orario && <span className="text-xs font-mono font-semibold text-blue-600">{formatOra(orario)}</span>}
                                  {p.giocata && <span className="text-xs text-green-600">✓</span>}
                                  {p.girone && <span className="text-xs text-gray-400">Girone {p.girone}</span>}
                                  {p.fase !== 'girone' && p.fase !== 'campionato' && p.fase !== 'solo_campionato' && (
                                    <span className="text-xs text-purple-500 capitalize">{p.fase}</span>
                                  )}
                                </div>
                                <div className="flex items-center">
                                  <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                                    <LogoSquadra squadra={p.squadra_casa!} size={28}/>
                                    <span className="text-xs font-medium text-gray-800 text-center leading-tight w-full px-1 line-clamp-2">{p.squadra_casa?.nome}</span>
                                  </div>
                                  <div className="flex-shrink-0 mx-2">
                                    <span className="block px-2 py-1 bg-gray-100 rounded-lg font-bold text-xs min-w-[44px] text-center">
                                      {p.giocata ? `${p.gol_casa}–${p.gol_ospite}` : 'vs'}
                                    </span>
                                  </div>
                                  <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                                    <LogoSquadra squadra={p.squadra_ospite!} size={28}/>
                                    <span className="text-xs font-medium text-gray-800 text-center leading-tight w-full px-1 line-clamp-2">{p.squadra_ospite?.nome}</span>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* TABELLONE */}
        {tab === 'tabellone' && (
          <div className="space-y-4">
            <p className="text-xs text-gray-500 bg-white border border-gray-200 rounded-lg px-4 py-2">
              Le prime classificate di ogni girone accedono alla fase eliminatoria
            </p>
            {partiteElim.length === 0
              ? <div className="text-center py-12 text-gray-400">La fase eliminatoria non è ancora iniziata</div>
              : (
                <div className="flex gap-6 overflow-x-auto pb-2">
                  {(['quarti','semifinale','finale'] as const).map(fase => {
                    const pf = partiteElim.filter(p => p.fase === fase)
                    if (pf.length === 0) return null
                    const label = fase==='quarti' ? 'Quarti' : fase==='semifinale' ? 'Semifinali' : 'Finale'
                    return (
                      <div key={fase} className="flex flex-col gap-3 min-w-[180px]">
                        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-center">{label}</div>
                        {pf.map(p => (
                          <div key={p.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                            {[
                              { sq: p.squadra_casa, gol: p.gol_casa, win: p.giocata && (p.gol_casa??0)>(p.gol_ospite??0) },
                              { sq: p.squadra_ospite, gol: p.gol_ospite, win: p.giocata && (p.gol_ospite??0)>(p.gol_casa??0) }
                            ].map((row, i) => (
                              <div key={i} className={`flex items-center gap-2 px-3 py-2 ${i===0?'border-b border-gray-100':''}`}
                                style={row.win ? { background: primary+'08', fontWeight:600 } : {}}>
                                <LogoSquadra squadra={row.sq ?? { nome:'?', logo_url:null }} size={22}/>
                                <span className="flex-1 text-sm truncate">{row.sq?.nome ?? '–'}</span>
                                <span className="font-bold text-sm" style={row.win ? { color: primary } : { color: '#9ca3af' }}>
                                  {p.giocata ? row.gol : ''}
                                </span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              )
            }
          </div>
        )}
      </div>
    </div>
  )
}

function ClassificaTable({ stats, primary }: { stats: any[]; primary: string }) {
  return (
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
        {stats.map((s: any, i: number) => (
          <tr key={s.squadra.id} style={i < 3 ? { background: primary + '0d' } : {}}>
            <td className="px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-xs w-5 text-center font-medium" style={{ color: i < 3 ? primary : '#9ca3af' }}>{i+1}</span>
                <LogoSquadra squadra={s.squadra} size={22}/>
                <span className="font-medium truncate">{s.squadra.nome}</span>
              </div>
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
  )
}

function MatchRow({ p, primary, upcoming }: { p: Partita; primary: string; upcoming?: boolean }) {
  return (
    <div className="border-b border-gray-50 last:border-0">
      {upcoming && p.data_ora && (
        <div className="px-4 pt-2 text-xs text-gray-400 text-center">
          {new Date(p.data_ora).toLocaleString('it-IT', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
        </div>
      )}
      <div className="flex items-center px-3 py-3">
        <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
          <LogoSquadra squadra={p.squadra_casa!} size={32}/>
          <span className="text-xs font-medium text-gray-800 text-center leading-tight w-full px-1 line-clamp-2">
            {p.squadra_casa?.nome}
          </span>
        </div>
        <div className="flex-shrink-0 mx-3 text-center">
          {upcoming
            ? <span className="block px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-400 min-w-[48px]">vs</span>
            : <span className="block px-3 py-1.5 bg-gray-100 rounded-lg font-bold text-sm min-w-[48px]">{p.gol_casa}–{p.gol_ospite}</span>
          }
        </div>
        <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
          <LogoSquadra squadra={p.squadra_ospite!} size={32}/>
          <span className="text-xs font-medium text-gray-800 text-center leading-tight w-full px-1 line-clamp-2">
            {p.squadra_ospite?.nome}
          </span>
        </div>
      </div>
    </div>
  )
}
