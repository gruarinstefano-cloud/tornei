'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { Torneo, Squadra, Partita, Campo, Sponsor, Giornata, Girone, CalendarioItem, Pausa } from '@/lib/types'
import { calcolaClassifica, calcolaOrariSlot, formatOra, formatDataBreve } from '@/lib/types'
import LogoSquadra from '@/components/LogoSquadra'
import BannerTorneo from '@/components/BannerTorneo'
import Link from 'next/link'

type Tab = 'gironi' | 'partite' | 'squadre' | 'tabellone' | 'info'

export default function TorneoPage() {
  const { slug } = useParams<{ slug: string }>()
  const [torneo, setTorneo] = useState<Torneo | null>(null)
  const [squadre, setSquadre] = useState<Squadra[]>([])
  const [partite, setPartite] = useState<Partita[]>([])
  const [campi, setCampi] = useState<Campo[]>([])
  const [sponsor, setSponsor] = useState<Sponsor[]>([])
  const [gironiObj, setGironiObj] = useState<Girone[]>([])
  const [giornate, setGiornate] = useState<Giornata[]>([])
  const [pause, setPause] = useState<Pausa[]>([])
  const [tab, setTab] = useState<Tab>('gironi')
  const [squadraSelId, setSquadraSelId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sb = createClient()
    sb.from('tornei').select('*').eq('slug', slug).single()
      .then(async ({ data: t }) => {
        if (!t) { setLoading(false); return }
        setTorneo(t)
        const [sq, pa, ca, sp, gi, gn, pu] = await Promise.all([
          sb.from('squadre').select('*').eq('torneo_id', t.id),
          sb.from('partite').select('*, squadra_casa:squadre!squadra_casa_id(*), squadra_ospite:squadre!squadra_ospite_id(*), campo:campi(*)').eq('torneo_id', t.id).order('ordine_calendario', { nullsFirst: false }),
          sb.from('campi').select('*').eq('torneo_id', t.id).order('ordine'),
          sb.from('sponsor').select('*').eq('torneo_id', t.id).order('ordine'),
          sb.from('gironi').select('*').eq('torneo_id', t.id).order('ordine'),
          sb.from('giornate').select('*, slot:slot_campo(*)').eq('torneo_id', t.id).order('data'),
          sb.from('pause').select('*').eq('torneo_id', t.id).order('ordine_calendario'),
        ])
        setSquadre(sq.data ?? [])
        setPartite((pa.data ?? []) as Partita[])
        setCampi(ca.data ?? [])
        setSponsor(sp.data ?? [])
        setGironiObj((gi.data ?? []) as Girone[])
        setGiornate((gn.data ?? []) as Giornata[])
        setPause(pu.data ?? [])
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
  const fasiElim: Partita['fase'][] = ['ottavi','quarti','semifinale','finale','terzo_posto']
  const isSoloCampionato = torneo.tipo === 'solo_campionato'
  const isCampionato = torneo.tipo === 'campionato_eliminazione' || isSoloCampionato
  const partiteElim = partite.filter(p => fasiElim.includes(p.fase))
  const primaTabLabel = isCampionato ? 'Classifica' : 'Gironi'

  const tabs: [Tab, string][] = [
    ['gironi', primaTabLabel],
    ['partite', 'Partite'],
    ['squadre', 'Squadre'],
    ...(!isSoloCampionato ? [['tabellone', 'Fase eliminatoria']] as [Tab,string][] : []),
    ['info', 'Info'],
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <BannerTorneo torneo={torneo} sponsor={sponsor}/>
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {tabs.map(([key, label]) => (
            <button key={key} onClick={() => { setTab(key); setSquadraSelId(null) }}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition ${tab===key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              style={tab===key ? { borderColor: primary, color: primary } : {}}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* GIRONI / CLASSIFICA - FIX 4: mostra tutte le squadre anche a 0 */}
        {tab === 'gironi' && (
          <div className="grid gap-5 md:grid-cols-2">
            {isCampionato && gironiObj.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden md:col-span-2">
                <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100" style={{ background: primary+'10' }}>Classifica generale</div>
                <ClassificaTable stats={calcolaClassifica(squadre, partite)} primary={primary}/>
              </div>
            ) : gironiObj.map(g => (
              <div key={g.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100" style={{ background: primary+'10' }}>Girone {g.nome}</div>
                <ClassificaTable stats={calcolaClassifica(squadre.filter(s => s.girone_id === g.id), partite, g.id)} primary={primary}/>
              </div>
            ))}
            {!isCampionato && gironiObj.length === 0 && <div className="col-span-2 text-center py-12 text-gray-400">Nessun girone configurato</div>}
          </div>
        )}

        {/* PARTITE - FIX 1+2 */}
        {tab === 'partite' && (
          <div className="space-y-6">
            {!isSoloCampionato && gironiObj.length > 0 && (
              <SchemaQualificazione gironi={gironiObj} squadre={squadre} partite={partite} partiteElim={partiteElim} torneo={torneo} primary={primary}/>
            )}
            {(giornate.length > 0 ? giornate : [null]).map(giornata => {
              const gId = giornata?.id ?? null
              const partiteGiornata = partite.filter(p => !fasiElim.includes(p.fase) && (!gId || p.giornata_id === gId))
              if (partiteGiornata.length === 0 && giornate.length > 0) return null
              return (
                <div key={giornata?.id ?? 'no-date'}>
                  {giornata && (
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-gray-300 inline-block"/>
                      {formatDataBreve(giornata.data)}
                    </h3>
                  )}
                  {(() => {
                    const campiUsati = campi.filter(cc => partiteGiornata.some(p => p.campo_id === cc.id))
                    const senzaCampo = partiteGiornata.filter(p => !p.campo_id)
                    return (
                      <div className="space-y-4">
                        {campiUsati.length > 0 && (
                          <div className={`grid gap-4 ${campiUsati.length > 1 ? 'md:grid-cols-2' : ''}`}>
                            {campiUsati.map(campo => {
                              const itemsP = partiteGiornata.filter(p => p.campo_id === campo.id).map(p => ({ kind: 'partita' as const, data: p }))
                              const itemsPu = pause.filter(pu => pu.campo_id === campo.id && (!gId || pu.giornata_id === gId)).map(pu => ({ kind: 'pausa' as const, data: pu }))
                              const allItems: CalendarioItem[] = [...itemsP, ...itemsPu].sort((a,b) => a.data.ordine_calendario - b.data.ordine_calendario)
                              const slotOrario = (giornata?.slot as any[])?.find((s:any) => s.campo_id === campo.id)?.orario_inizio ?? '09:00'
                              // FIX 2: orari calcolati correttamente
                              const orariMap = giornata?.data
                                ? calcolaOrariSlot(allItems, giornata.data, slotOrario, (torneo as any).durata_partita_minuti ?? 20, (torneo as any).durata_partita_eliminazione_minuti ?? 20, (torneo as any).tempo_tecnico_minuti ?? 5)
                                : new Map<string, Date>()
                              return (
                                <div key={campo.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                  <div className="px-4 py-2.5 flex items-center gap-2 border-b border-gray-100" style={{ background: campo.colore+'12' }}>
                                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: campo.colore }}/>
                                    <span className="font-semibold text-sm text-gray-800">{campo.nome}</span>
                                    <span className="ml-auto text-xs text-gray-400">{slotOrario}</span>
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
                                      return <div key={item.data.id} className="px-4 py-2" style={{ background: item.data.colore+'15' }}><span className="text-xs font-medium text-amber-700">{item.data.etichetta} — {item.data.durata_minuti} min</span></div>
                                    }
                                    return <PartitaCard key={item.data.id} p={item.data} orario={orariMap.get(item.data.id)} primary={primary}/>
                                  })}
                                </div>
                              )
                            })}
                          </div>
                        )}
                        {senzaCampo.length > 0 && (
                          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                            <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
                              <span className="text-xs font-semibold text-gray-500">Campo da assegnare</span>
                            </div>
                            {senzaCampo.map(p => <PartitaCard key={p.id} p={p} orario={undefined} primary={primary}/>)}
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              )
            })}
            {/* FIX 1: partite elim visibili anche senza giornata */}
            {partiteElim.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-300 inline-block"/>
                  Fase eliminatoria
                </h3>
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {partiteElim.map(p => <PartitaCard key={p.id} p={p} orario={undefined} primary={primary}/>)}
                </div>
              </div>
            )}
            {/* FIX 1: schema visibile anche se non ancora generata */}
            {partiteElim.length === 0 && !isSoloCampionato && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
                <p className="text-sm text-gray-400">La fase eliminatoria non è ancora stata generata</p>
                <p className="text-xs text-gray-400 mt-1">Gli accoppiamenti saranno visibili al termine dei gironi</p>
              </div>
            )}
            {partite.length === 0 && <div className="text-center py-12 text-gray-400">Nessuna partita ancora programmata</div>}
          </div>
        )}

        {/* SQUADRE */}
        {tab === 'squadre' && (
          <div>
            {squadraSelId ? (
              <SquadraDettaglio squadraId={squadraSelId} squadre={squadre} gironi={gironiObj} partite={partite} primary={primary} isSoloCampionato={isSoloCampionato} onBack={() => setSquadraSelId(null)}/>
            ) : (
              <div>
                {gironiObj.length > 0 ? (
                  <div className="space-y-5">
                    {gironiObj.map(g => (
                      <div key={g.id}>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 px-1">Girone {g.nome}</h3>
                        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                          {squadre.filter(s => s.girone_id === g.id).map(s => <SquadraCard key={s.id} squadra={s} primary={primary} onClick={() => setSquadraSelId(s.id)}/>)}
                        </div>
                      </div>
                    ))}
                    {squadre.filter(s => !s.girone_id).length > 0 && (
                      <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                        {squadre.filter(s => !s.girone_id).map(s => <SquadraCard key={s.id} squadra={s} primary={primary} onClick={() => setSquadraSelId(s.id)}/>)}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                    {squadre.map(s => <SquadraCard key={s.id} squadra={s} primary={primary} onClick={() => setSquadraSelId(s.id)}/>)}
                  </div>
                )}
                {squadre.length === 0 && <div className="text-center py-12 text-gray-400">Nessuna squadra</div>}
              </div>
            )}
          </div>
        )}

        {/* TABELLONE */}
        {tab === 'tabellone' && (
          <div className="space-y-5">
            {gironiObj.length > 0 && (
              <SchemaQualificazione gironi={gironiObj} squadre={squadre} partite={partite} partiteElim={partiteElim} torneo={torneo} primary={primary}/>
            )}
            {partiteElim.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400">Gli accoppiamenti saranno disponibili al termine della fase a gironi</div>
            ) : (
              <div className="flex gap-5 overflow-x-auto pb-2">
                {(['ottavi','quarti','semifinale','finale','terzo_posto'] as const).map(fase => {
                  const pf = partiteElim.filter(p => p.fase === fase)
                  if (pf.length === 0) return null
                  const lbl = {ottavi:'Ottavi',quarti:'Quarti',semifinale:'Semifinali',finale:'Finale',terzo_posto:'3°/4°'}[fase]
                  return (
                    <div key={fase} className="flex flex-col gap-3 min-w-[180px]">
                      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-center">{lbl}</div>
                      {pf.map(p => (
                        <div key={p.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                          {[{sq:p.squadra_casa,gol:p.gol_casa,win:p.giocata&&(p.gol_casa??0)>(p.gol_ospite??0)},{sq:p.squadra_ospite,gol:p.gol_ospite,win:p.giocata&&(p.gol_ospite??0)>(p.gol_casa??0)}].map((row,i) => (
                            <div key={i} className={`flex items-center gap-2 px-3 py-2 ${i===0?'border-b border-gray-100':''}`} style={row.win?{background:primary+'08',fontWeight:600}:{}}>
                              <LogoSquadra squadra={row.sq ?? {nome:'?',logo_url:null}} size={22}/>
                              <span className="flex-1 text-sm truncate">{(row.sq as any)?.nome ?? '–'}</span>
                              {p.giocata && <span className="font-bold text-sm" style={row.win?{color:primary}:{color:'#9ca3af'}}>{row.gol}</span>}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* INFO */}
        {tab === 'info' && (
          <div className="space-y-4">
            {(torneo as any).luogo && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-2"><span>📍</span><h3 className="text-sm font-semibold text-gray-700">Sede</h3></div>
                <p className="text-sm text-gray-600">{(torneo as any).luogo}</p>
              </div>
            )}
            {(torneo as any).info_testo && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-3"><span>📋</span><h3 className="text-sm font-semibold text-gray-700">Informazioni</h3></div>
                <div className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{(torneo as any).info_testo}</div>
              </div>
            )}
            {!(torneo as any).luogo && !(torneo as any).info_testo && <div className="text-center py-12 text-gray-400">Nessuna informazione disponibile</div>}
          </div>
        )}
      </div>
    </div>
  )
}

function ClassificaTable({ stats, primary }: { stats: any[]; primary: string }) {
  if (stats.length === 0) return <div className="px-4 py-4 text-sm text-gray-400 text-center">Nessuna squadra</div>
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
          <tr key={s.squadra.id} style={i<2?{background:primary+'0d'}:{}}>
            <td className="px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-xs w-5 text-center font-medium" style={{color:i<2?primary:'#9ca3af'}}>{i+1}</span>
                <LogoSquadra squadra={s.squadra} size={22}/>
                <span className="font-medium truncate">{s.squadra.nome}</span>
              </div>
            </td>
            <td className="text-center px-1 py-2 text-gray-600">{s.g}</td>
            <td className="text-center px-1 py-2 text-gray-600">{s.v}</td>
            <td className="text-center px-1 py-2 text-gray-600">{s.p}</td>
            <td className="text-center px-1 py-2 text-gray-600">{s.s}</td>
            <td className="text-center px-1 py-2 text-gray-600">{s.gf}</td>
            <td className="text-center px-2 py-2 font-bold" style={{color:primary}}>{s.pt}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function PartitaCard({ p, orario, primary }: { p: Partita; orario?: Date; primary: string }) {
  const fasiElimLabel: Record<string,string> = {ottavi:'Ottavi',quarti:'Quarti',semifinale:'Semifinale',finale:'Finale',terzo_posto:'3°/4° posto'}
  const isFaseElim = ['ottavi','quarti','semifinale','finale','terzo_posto'].includes(p.fase)
  return (
    <div className="border-b border-gray-50 last:border-0">
      <div className="flex items-center justify-center gap-2 px-3 pt-2.5 pb-0.5">
        {orario ? <span className="text-xs font-mono font-semibold" style={{color:primary}}>{formatOra(orario)}</span> : null}
        {p.girone && <span className="text-xs text-gray-400">Girone {p.girone}</span>}
        {isFaseElim && <span className="text-xs font-medium text-purple-500">{fasiElimLabel[p.fase]}</span>}
        {p.giocata && <span className="text-xs text-green-500">✓</span>}
      </div>
      <div className="flex items-center px-3 pb-2.5 pt-1">
        <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
          <LogoSquadra squadra={(p.squadra_casa as any) ?? {nome:'?',logo_url:null}} size={30}/>
          <span className="text-xs font-medium text-gray-800 text-center leading-tight w-full px-1 line-clamp-2">{(p.squadra_casa as any)?.nome ?? '–'}</span>
        </div>
        <div className="flex-shrink-0 mx-3 text-center">
          {!p.giocata
            ? <span className="block px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-400 min-w-[52px]">vs</span>
            : <span className="block px-3 py-1.5 bg-gray-100 rounded-lg font-bold text-sm min-w-[52px]">{p.gol_casa}–{p.gol_ospite}</span>
          }
        </div>
        <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
          <LogoSquadra squadra={(p.squadra_ospite as any) ?? {nome:'?',logo_url:null}} size={30}/>
          <span className="text-xs font-medium text-gray-800 text-center leading-tight w-full px-1 line-clamp-2">{(p.squadra_ospite as any)?.nome ?? '–'}</span>
        </div>
      </div>
    </div>
  )
}

function SchemaQualificazione({ gironi, squadre, partite, partiteElim, torneo, primary }: {
  gironi: any[]; squadre: any[]; partite: any[]; partiteElim: any[]; torneo: any; primary: string
}) {
  const schemaRaw = torneo.schema_eliminatoria
  const schema: any[] = schemaRaw
    ? (typeof schemaRaw === 'string' ? JSON.parse(schemaRaw) : schemaRaw)
    : []

  if (gironi.length === 0 && schema.length === 0 && partiteElim.length === 0) return null

  const nElim = torneo.n_squadre_eliminatoria ?? 4
  const nPerGirone = Math.max(1, Math.ceil(nElim / Math.max(gironi.length, 1)))
  const faseLabel: Record<string,string> = {
    ottavi:'Ottavi di finale', quarti:'Quarti di finale',
    semifinale:'Semifinali', finale:'Finale', terzo_posto:'3°/4° posto'
  }

  // Tutte le fasi previste dallo schema o dalle partite generate
  const fasiSchema = [...new Set(schema.map((m:any) => m.fase))]
  const fasiGenerati = [...new Set(partiteElim.map((p:any) => p.fase))]
  const tuttiLeFasi = [...new Set([...fasiSchema, ...fasiGenerati])]
  const ordFasi = ['ottavi','quarti','semifinale','finale','terzo_posto']
  tuttiLeFasi.sort((a,b) => ordFasi.indexOf(a) - ordFasi.indexOf(b))

  // Calcola orari per le partite elim
  const giornataElimId = torneo.giornata_eliminatoria_id
  const orarioElimInizio = torneo.orario_eliminatoria || '09:00'

  // Helper: etichetta slot anonima
  function labelSlot(s: any): string {
    if (!s) return '?'
    if (s.tipo === 'girone') return `${s.pos}° Girone ${s.gironeNome}`
    const refMatch = schema.find((m:any) => m.id === s.matchId)
    const refLabel = refMatch?.label ?? s.matchId
    return `${s.esito === 'vincente' ? 'Vincente' : 'Perdente'} ${refLabel}`
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2" style={{ background: primary+'10' }}>
        <span className="text-sm font-semibold text-gray-700">Fase eliminatoria</span>
        {gironi.length > 0 && <span className="text-xs text-gray-400 ml-auto">Prime {nPerGirone} di ogni girone si qualificano</span>}
      </div>

      <div className="divide-y divide-gray-50">
        {tuttiLeFasi.map(fase => {
          const partiteFase = partiteElim.filter((p:any) => p.fase === fase)
          const matchFase = schema.filter((m:any) => m.fase === fase)
          const haPartite = partiteFase.length > 0

          return (
            <div key={fase} className="p-4">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2.5">
                {faseLabel[fase] ?? fase}
              </div>

              {haPartite ? (
                // Partite reali già generate — con orario calcolato
                <div className="space-y-2">
                  {partiteFase.map((p:any) => {
                    const giornata = p.giornata_id
                    return (
                      <div key={p.id} className="border border-gray-200 rounded-xl overflow-hidden">
                        {/* Info orario */}
                        {(p.data_ora || giornata) && (
                          <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                            {p.data_ora
                              ? <span className="text-xs font-mono font-semibold" style={{ color: primary }}>
                                  {new Date(p.data_ora).toLocaleTimeString('it-IT', { hour:'2-digit', minute:'2-digit' })}
                                </span>
                              : <span className="text-xs text-gray-400">Orario da definire</span>
                            }
                            {p.campo && <span className="text-xs text-gray-400">· {(p.campo as any).nome}</span>}
                          </div>
                        )}
                        {/* Squadre */}
                        {[
                          { sq: p.squadra_casa, gol: p.gol_casa, win: p.giocata && (p.gol_casa??0)>(p.gol_ospite??0) },
                          { sq: p.squadra_ospite, gol: p.gol_ospite, win: p.giocata && (p.gol_ospite??0)>(p.gol_casa??0) }
                        ].map((row, i) => (
                          <div key={i} className={`flex items-center gap-2 px-3 py-2.5 ${i===0?'border-b border-gray-100':''}`}
                            style={row.win ? { background: primary+'0d', fontWeight: 600 } : {}}>
                            <LogoSquadra squadra={row.sq ?? {nome:'?',logo_url:null}} size={22}/>
                            <span className="flex-1 text-sm truncate">{(row.sq as any)?.nome ?? '–'}</span>
                            {p.giocata && <span className="text-sm font-bold" style={row.win?{color:primary}:{color:'#9ca3af'}}>{row.gol}</span>}
                            {!p.giocata && <span className="text-xs text-gray-300">–</span>}
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              ) : (
                // Schema anonimo — partite non ancora generate
                <div className="space-y-1.5">
                  {matchFase.map((m:any, idx:number) => (
                    <div key={m.id} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
                      <span className="text-xs text-gray-400 w-4 text-center flex-shrink-0">{idx+1}</span>
                      <span className="flex-1 text-sm text-gray-600 text-right">{labelSlot(m.casa)}</span>
                      <span className="text-xs text-gray-400 px-2 flex-shrink-0">vs</span>
                      <span className="flex-1 text-sm text-gray-600">{labelSlot(m.ospite)}</span>
                    </div>
                  ))}
                  {matchFase.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-2">
                      Da definire in base ai risultati precedenti
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
        {tuttiLeFasi.length === 0 && (
          <div className="p-4 text-sm text-gray-400 text-center">Schema non ancora configurato</div>
        )}
      </div>
    </div>
  )
}

function SquadraCard({ squadra, primary, onClick }: { squadra: any; primary: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 hover:shadow-md transition text-left w-full">
      <LogoSquadra squadra={squadra} size={40}/>
      <div className="min-w-0">
        <div className="font-semibold text-gray-800 text-sm truncate">{squadra.nome}</div>
        {squadra.girone && <div className="text-xs text-gray-400 mt-0.5">Girone {squadra.girone}</div>}
      </div>
      <span className="ml-auto text-gray-300 flex-shrink-0">›</span>
    </button>
  )
}

function SquadraDettaglio({ squadraId, squadre, gironi, partite, primary, isSoloCampionato, onBack }: {
  squadraId: string; squadre: any[]; gironi: any[]; partite: any[]
  primary: string; isSoloCampionato: boolean; onBack: () => void
}) {
  const squadra = squadre.find(s => s.id === squadraId)
  if (!squadra) return null
  const fasiElim = ['ottavi','quarti','semifinale','finale','terzo_posto']
  const miePartite = partite.filter(p => p.squadra_casa_id === squadraId || p.squadra_ospite_id === squadraId).sort((a:any,b:any) => a.ordine_calendario - b.ordine_calendario)
  const partiteGirone = miePartite.filter(p => !fasiElim.includes(p.fase))
  const partiteElimSq = miePartite.filter(p => fasiElim.includes(p.fase))
  const girone = gironi.find(g => g.id === squadra.girone_id)
  const sqGirone = girone ? squadre.filter(s => s.girone_id === girone.id) : squadre
  const classifica = calcolaClassifica(sqGirone, partite.filter(p => !fasiElim.includes(p.fase)), girone?.id)
  const miaPos = classifica.findIndex(s => s.squadra.id === squadraId)
  const mieStats = classifica.find(s => s.squadra.id === squadraId)
  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-5">← Tutte le squadre</button>
      <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4 mb-5">
        <LogoSquadra squadra={squadra} size={56}/>
        <div>
          <h2 className="text-xl font-bold text-gray-900">{squadra.nome}</h2>
          {girone && <p className="text-sm text-gray-500 mt-0.5">Girone {girone.nome}</p>}
        </div>
        {mieStats && (
          <div className="ml-auto flex gap-4 text-center">
            <div><div className="text-2xl font-bold" style={{color:primary}}>{mieStats.pt}</div><div className="text-xs text-gray-400">punti</div></div>
            <div className="border-l border-gray-100 pl-4"><div className="text-2xl font-bold text-gray-700">{miaPos+1}°</div><div className="text-xs text-gray-400">posizione</div></div>
          </div>
        )}
      </div>
      {mieStats && mieStats.g > 0 && (
        <div className="grid grid-cols-4 gap-2 mb-5">
          {[{label:'Vittorie',val:mieStats.v,color:'#16a34a'},{label:'Pareggi',val:mieStats.p,color:'#d97706'},{label:'Sconfitte',val:mieStats.s,color:'#dc2626'},{label:'Gol fatti',val:mieStats.gf,color:primary}].map(stat => (
            <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-3 text-center">
              <div className="text-xl font-bold" style={{color:stat.color}}>{stat.val}</div>
              <div className="text-xs text-gray-400 mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>
      )}
      {partiteGirone.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
          <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100" style={{background:primary+'0a'}}>{isSoloCampionato?'Partite':'Fase gironi'}</div>
          {partiteGirone.map((p:any) => <PartitaSquadraRow key={p.id} p={p} squadraId={squadraId} primary={primary}/>)}
        </div>
      )}
      {partiteElimSq.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
          <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100" style={{background:primary+'0a'}}>Fase eliminatoria</div>
          {partiteElimSq.map((p:any) => <PartitaSquadraRow key={p.id} p={p} squadraId={squadraId} primary={primary}/>)}
        </div>
      )}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100" style={{background:primary+'0a'}}>{girone?`Classifica Girone ${girone.nome}`:'Classifica'}</div>
        <ClassificaTable stats={classifica} primary={primary}/>
      </div>
    </div>
  )
}

function PartitaSquadraRow({ p, squadraId, primary }: { p: any; squadraId: string; primary: string }) {
  const isCasa = p.squadra_casa_id === squadraId
  const avversario = isCasa ? p.squadra_ospite : p.squadra_casa
  const golMiei = isCasa ? p.gol_casa : p.gol_ospite
  const golAvv = isCasa ? p.gol_ospite : p.gol_casa
  const vinto = p.giocata && (golMiei??0)>(golAvv??0)
  const pareggio = p.giocata && (golMiei??0)===(golAvv??0)
  const perso = p.giocata && (golMiei??0)<(golAvv??0)
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
      {p.giocata
        ? <span className={`text-xs font-bold w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-white ${vinto?'bg-green-500':pareggio?'bg-gray-400':'bg-red-500'}`}>{vinto?'V':pareggio?'P':'S'}</span>
        : <span className="text-xs w-5 h-5 rounded border border-gray-200 flex items-center justify-center flex-shrink-0 text-gray-400">–</span>
      }
      <span className="text-xs text-gray-400 w-4 flex-shrink-0">{isCasa?'C':'T'}</span>
      <LogoSquadra squadra={avversario??{nome:'?',logo_url:null}} size={24}/>
      <span className="flex-1 text-sm font-medium text-gray-800 truncate">{avversario?.nome??'–'}</span>
      {p.giocata
        ? <span className="text-sm font-bold flex-shrink-0" style={{color:vinto?'#16a34a':perso?'#dc2626':'#6b7280'}}>{golMiei}–{golAvv}</span>
        : <span className="text-xs text-gray-400 flex-shrink-0">da giocare</span>
      }
    </div>
  )
}
