'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { Torneo, Squadra, Partita, Campo, Sponsor, Giornata, SlotCampo, CalendarioItem, Pausa } from '@/lib/types'
import { calcolaClassifica, calcolaOrariSlot, formatOra, formatDataBreve } from '@/lib/types'
import LogoSquadra from '@/components/LogoSquadra'
import BannerTorneo from '@/components/BannerTorneo'
import Link from 'next/link'

type Tab = 'gironi' | 'partite' | 'tabellone' | 'squadre' | 'info'

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
  const [squadraSelId, setSquadraSelId] = useState<string | null>(null)
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
          {([['gironi', primaTabLabel],['partite','Partite'],['squadre','Squadre'],...(!isSoloCampionato ? [['tabellone','Fase eliminatoria']] : []),['info','Info']] as [Tab,string][]).map(([key,label]) => (
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

        {/* PARTITE — risultati + programma unificati + schema qualificazione */}
        {tab === 'partite' && (
          <div className="space-y-6">
            {/* Schema qualificazione — sempre visibile se torneo ha fase elim */}
            {!isSoloCampionato && (
              <SchemaQualificazione
                gironi={gironiObj}
                squadre={squadre}
                partite={partite}
                partiteElim={partiteElim}
                nElim={(torneo as any).n_squadre_eliminatoria ?? 4}
                primary={primary}/>
            )}

            {/* Partite per giornata e campo */}
            {giornate.length === 0 && campi.length === 0 && partite.length === 0 && (
              <div className="text-center py-12 text-gray-400">Nessuna partita ancora programmata</div>
            )}
            {(giornate.length > 0 ? giornate : [null]).map(giornata => {
              const gId = giornata?.id ?? null
              const partiteGiornata = partite.filter(p => !gId || p.giornata_id === gId)
              if (partiteGiornata.length === 0 && giornate.length > 0) return null
              return (
                <div key={giornata?.id ?? 'no-date'}>
                  {giornata && (
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-gray-300 inline-block"/>
                      {formatDataBreve(giornata.data)}
                    </h3>
                  )}
                  <div className="space-y-3">
                    {(() => {
                      // Costruisce lista unificata ordinata per ordine_calendario + campo
                      const itemsAll: { p: Partita; orario: Date | undefined; pausa?: Pausa }[] = []
                      const allPartite = partite
                        .filter(p => !gId || p.giornata_id === gId)
                        .sort((a,b) => a.ordine_calendario - b.ordine_calendario)

                      // Raggruppa per campo
                      const campiUsati = campi.filter(cc =>
                        allPartite.some(p => p.campo_id === cc.id) ||
                        pause.some(pu => pu.campo_id === cc.id && (!gId || pu.giornata_id === gId))
                      )
                      const campiNoField = allPartite.filter(p => !p.campo_id)

                      return (
                        <div className={`grid gap-4 ${campiUsati.length > 1 ? 'md:grid-cols-2' : ''}`}>
                          {campiUsati.map(campo => {
                            const itemsP = allPartite
                              .filter(p => p.campo_id === campo.id)
                              .map(p => ({ kind: 'partita' as const, data: p }))
                            const itemsPu = pause
                              .filter(pu => pu.campo_id === campo.id && (!gId || pu.giornata_id === gId))
                              .map(pu => ({ kind: 'pausa' as const, data: pu }))
                            const allItems: CalendarioItem[] = [...itemsP, ...itemsPu]
                              .sort((a,b) => a.data.ordine_calendario - b.data.ordine_calendario)
                            const slotOrario = giornata?.slot?.find(s => s.campo_id === campo.id)?.orario_inizio ?? '09:00'
                            const orariMap = giornata
                              ? calcolaOrariSlot(allItems, giornata.data, slotOrario,
                                  (torneo as any).durata_partita_minuti ?? 20,
                                  (torneo as any).durata_partita_eliminazione_minuti ?? 20,
                                  (torneo as any).tempo_tecnico_minuti ?? 5)
                              : new Map<string, Date>()

                            return (
                              <div key={campo.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                <div className="px-4 py-2.5 flex items-center gap-2 border-b border-gray-100"
                                  style={{ background: campo.colore + '12' }}>
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
                                    return (
                                      <div key={item.data.id} className="px-4 py-2" style={{ background: item.data.colore+'15' }}>
                                        <span className="text-xs font-medium text-amber-700">{item.data.etichetta} — {item.data.durata_minuti} min</span>
                                      </div>
                                    )
                                  }
                                  const p = item.data
                                  const orario = orariMap.get(p.id)
                                  const isFaseElim = ['quarti','semifinale','finale','terzo_posto'].includes(p.fase)
                                  return (
                                    <PartitaCard key={p.id} p={p} orario={orario} primary={primary} showFase={isFaseElim}/>
                                  )
                                })}
                              </div>
                            )
                          })}
                          {/* Partite senza campo assegnato */}
                          {campiNoField.length > 0 && campiUsati.length === 0 && (
                            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                              {campiNoField.map(p => (
                                <PartitaCard key={p.id} p={p} orario={undefined} primary={primary} showFase={false}/>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* TABELLONE */}
        {tab === 'tabellone' && (
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 space-y-1">
              <p className="text-xs text-gray-600 font-medium">Schema fase eliminatoria</p>
              <p className="text-xs text-gray-400">Le prime classificate di ogni girone accedono alla fase eliminatoria</p>
            </div>
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

        {/* SQUADRE */}
        {tab === 'squadre' && (
          <div>
            {squadraSelId ? (
              <SquadraDettaglio
                squadraId={squadraSelId}
                squadre={squadre}
                gironi={gironiObj}
                partite={partite}
                primary={primary}
                isSoloCampionato={isSoloCampionato}
                onBack={() => setSquadraSelId(null)}/>
            ) : (
              <div>
                {/* Raggruppa per girone */}
                {gironiObj.length > 0 ? (
                  <div className="space-y-5">
                    {gironiObj.map((g: any) => (
                      <div key={g.id}>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 px-1">
                          Girone {g.nome}
                        </h3>
                        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                          {squadre.filter(s => s.girone_id === g.id).map(s => (
                            <SquadraCard key={s.id} squadra={s} primary={primary}
                              onClick={() => setSquadraSelId(s.id)}/>
                          ))}
                        </div>
                      </div>
                    ))}
                    {squadre.filter(s => !s.girone_id).length > 0 && (
                      <div>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 px-1">Altre squadre</h3>
                        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                          {squadre.filter(s => !s.girone_id).map(s => (
                            <SquadraCard key={s.id} squadra={s} primary={primary}
                              onClick={() => setSquadraSelId(s.id)}/>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                    {squadre.map(s => (
                      <SquadraCard key={s.id} squadra={s} primary={primary}
                        onClick={() => setSquadraSelId(s.id)}/>
                    ))}
                  </div>
                )}
                {squadre.length === 0 && (
                  <div className="text-center py-12 text-gray-400">Nessuna squadra ancora registrata</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* INFO */}
        {tab === 'info' && (
          <div className="space-y-4">
            {(torneo as any).luogo && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">📍</span>
                  <h3 className="text-sm font-semibold text-gray-700">Sede dell'evento</h3>
                </div>
                <p className="text-sm text-gray-600 mt-2">{(torneo as any).luogo}</p>
              </div>
            )}
            {(torneo as any).info_testo && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">📋</span>
                  <h3 className="text-sm font-semibold text-gray-700">Informazioni</h3>
                </div>
                <div className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                  {(torneo as any).info_testo}
                </div>
              </div>
            )}
            {!(torneo as any).luogo && !(torneo as any).info_testo && (
              <div className="text-center py-12 text-gray-400">Nessuna informazione disponibile</div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}


function SquadraCard({ squadra, primary, onClick }: {
  squadra: any; primary: string; onClick: () => void
}) {
  return (
    <button onClick={onClick}
      className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 hover:shadow-md hover:border-gray-300 transition text-left w-full">
      <LogoSquadra squadra={squadra} size={40}/>
      <div className="min-w-0">
        <div className="font-semibold text-gray-800 text-sm truncate">{squadra.nome}</div>
        {squadra.girone && (
          <div className="text-xs text-gray-400 mt-0.5">Girone {squadra.girone}</div>
        )}
      </div>
      <span className="ml-auto text-gray-300 text-sm flex-shrink-0">›</span>
    </button>
  )
}

function SquadraDettaglio({ squadraId, squadre, gironi, partite, primary, isSoloCampionato, onBack }: {
  squadraId: string; squadre: any[]; gironi: any[]; partite: any[]
  primary: string; isSoloCampionato: boolean; onBack: () => void
}) {
  const squadra = squadre.find(s => s.id === squadraId)
  if (!squadra) return null

  // Partite di questa squadra
  const miePartite = partite.filter(p =>
    p.squadra_casa_id === squadraId || p.squadra_ospite_id === squadraId
  ).sort((a: any, b: any) => a.ordine_calendario - b.ordine_calendario)

  const fasiGirone = ['girone','campionato','solo_campionato']
  const fasiElim = ['quarti','semifinale','finale','terzo_posto']

  const partiteGirone = miePartite.filter(p => fasiGirone.includes(p.fase))
  const partiteElimSquadra = miePartite.filter(p => fasiElim.includes(p.fase))

  // Classifica del girone/campionato di riferimento
  const girone = gironi.find(g => g.id === squadra.girone_id)
  const squadreGirone = girone
    ? squadre.filter(s => s.girone_id === girone.id)
    : squadre
  const partiteRif = girone
    ? partite.filter(p => p.girone_id === girone.id)
    : partite.filter(p => fasiGirone.includes(p.fase))

  // Calcola classifica manualmente
  const classifica = squadreGirone.map(sq => {
    const mine = partiteRif.filter(p =>
      p.giocata && (p.squadra_casa_id === sq.id || p.squadra_ospite_id === sq.id)
    )
    let v=0, par=0, s=0, gf=0, gs=0
    mine.forEach((p: any) => {
      const casa = p.squadra_casa_id === sq.id
      const miei = casa ? (p.gol_casa??0) : (p.gol_ospite??0)
      const avv  = casa ? (p.gol_ospite??0) : (p.gol_casa??0)
      gf += miei; gs += avv
      if (miei > avv) v++; else if (miei === avv) par++; else s++
    })
    return { squadra: sq, g: mine.length, v, p: par, s, gf, gs, pt: v*3+par }
  }).sort((a: any, b: any) => b.pt - a.pt || (b.gf-b.gs)-(a.gf-a.gs) || b.gf-a.gf)

  const miaPos = classifica.findIndex(s => s.squadra.id === squadraId)

  // Stats personali
  const mieStats = classifica.find(s => s.squadra.id === squadraId)

  return (
    <div>
      {/* Back button */}
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-5 transition">
        <span>←</span> <span>Tutte le squadre</span>
      </button>

      {/* Header squadra */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4 mb-5">
        <LogoSquadra squadra={squadra} size={56}/>
        <div>
          <h2 className="text-xl font-bold text-gray-900">{squadra.nome}</h2>
          {girone && <p className="text-sm text-gray-500 mt-0.5">Girone {girone.nome}</p>}
        </div>
        {mieStats && (
          <div className="ml-auto flex gap-4 text-center">
            <div>
              <div className="text-2xl font-bold" style={{ color: primary }}>{mieStats.pt}</div>
              <div className="text-xs text-gray-400">punti</div>
            </div>
            <div className="border-l border-gray-100 pl-4">
              <div className="text-2xl font-bold text-gray-700">{miaPos + 1}°</div>
              <div className="text-xs text-gray-400">posizione</div>
            </div>
          </div>
        )}
      </div>

      {/* Stats riepilogo */}
      {mieStats && mieStats.g > 0 && (
        <div className="grid grid-cols-4 gap-2 mb-5">
          {[
            { label: 'Vittorie', val: mieStats.v, color: '#16a34a' },
            { label: 'Pareggi', val: mieStats.p, color: '#d97706' },
            { label: 'Sconfitte', val: mieStats.s, color: '#dc2626' },
            { label: 'Gol fatti', val: mieStats.gf, color: primary },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-3 text-center">
              <div className="text-xl font-bold" style={{ color: stat.color }}>{stat.val}</div>
              <div className="text-xs text-gray-400 mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Partite fase gironi */}
      {partiteGirone.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
          <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100"
            style={{ background: primary + '0a' }}>
            {isSoloCampionato ? 'Partite' : 'Fase gironi'}
          </div>
          {partiteGirone.map((p: any) => (
            <PartitaSquadraRow key={p.id} p={p} squadraId={squadraId} primary={primary}/>
          ))}
        </div>
      )}

      {/* Partite fase eliminatoria */}
      {partiteElimSquadra.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
          <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100"
            style={{ background: primary + '0a' }}>
            Fase eliminatoria
          </div>
          {partiteElimSquadra.map((p: any) => (
            <PartitaSquadraRow key={p.id} p={p} squadraId={squadraId} primary={primary}/>
          ))}
        </div>
      )}

      {/* Classifica girone/campionato */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100"
          style={{ background: primary + '0a' }}>
          {girone ? `Classifica Girone ${girone.nome}` : 'Classifica'}
        </div>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-50">
            <th className="text-left px-3 py-2 text-xs text-gray-400 font-medium">Squadra</th>
            <th className="text-center px-1 py-2 text-xs text-gray-400 font-medium">G</th>
            <th className="text-center px-1 py-2 text-xs text-gray-400 font-medium">V</th>
            <th className="text-center px-1 py-2 text-xs text-gray-400 font-medium">P</th>
            <th className="text-center px-1 py-2 text-xs text-gray-400 font-medium">S</th>
            <th className="text-center px-1 py-2 text-xs text-gray-400 font-medium">GF</th>
            <th className="text-center px-2 py-2 text-xs text-gray-400 font-medium">Pt</th>
          </tr></thead>
          <tbody>
            {classifica.map((s: any, i: number) => (
              <tr key={s.squadra.id}
                className={s.squadra.id === squadraId ? 'font-semibold' : ''}
                style={s.squadra.id === squadraId ? { background: primary + '0d' } : {}}>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs w-4 text-center text-gray-400">{i+1}</span>
                    <LogoSquadra squadra={s.squadra} size={20}/>
                    <span className="truncate">{s.squadra.nome}</span>
                    {s.squadra.id === squadraId && (
                      <span className="text-xs px-1.5 py-0.5 rounded text-white flex-shrink-0"
                        style={{ background: primary, fontSize: 10 }}>TU</span>
                    )}
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
      </div>
    </div>
  )
}

function PartitaSquadraRow({ p, squadraId, primary }: {
  p: any; squadraId: string; primary: string
}) {
  const isCasa = p.squadra_casa_id === squadraId
  const avversario = isCasa ? p.squadra_ospite : p.squadra_casa
  const golMiei = isCasa ? p.gol_casa : p.gol_ospite
  const golAvv = isCasa ? p.gol_ospite : p.gol_casa
  const vinto = p.giocata && (golMiei ?? 0) > (golAvv ?? 0)
  const pareggio = p.giocata && (golMiei ?? 0) === (golAvv ?? 0)
  const perso = p.giocata && (golMiei ?? 0) < (golAvv ?? 0)

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
      {/* Esito */}
      {p.giocata ? (
        <span className={`text-xs font-bold w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-white ${vinto ? 'bg-green-500' : pareggio ? 'bg-gray-400' : 'bg-red-500'}`}>
          {vinto ? 'V' : pareggio ? 'P' : 'S'}
        </span>
      ) : (
        <span className="text-xs w-5 h-5 rounded border border-gray-200 flex items-center justify-center flex-shrink-0 text-gray-400">–</span>
      )}
      {/* Casa/Trasferta */}
      <span className="text-xs text-gray-400 w-4 flex-shrink-0">{isCasa ? 'C' : 'T'}</span>
      {/* Avversario */}
      <LogoSquadra squadra={avversario ?? { nome:'?', logo_url:null }} size={24}/>
      <span className="flex-1 text-sm font-medium text-gray-800 truncate">{avversario?.nome ?? '–'}</span>
      {/* Risultato */}
      {p.giocata ? (
        <span className="text-sm font-bold flex-shrink-0"
          style={{ color: vinto ? '#16a34a' : perso ? '#dc2626' : '#6b7280' }}>
          {golMiei}–{golAvv}
        </span>
      ) : (
        <span className="text-xs text-gray-400 flex-shrink-0">da giocare</span>
      )}
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

function PartitaCard({ p, orario, primary, showFase }: {
  p: Partita; orario?: Date; primary: string; showFase?: boolean
}) {
  const isFutura = !p.giocata
  return (
    <div className="border-b border-gray-50 last:border-0">
      {/* Header riga: orario + fase + girone */}
      <div className="flex items-center justify-center gap-2 px-3 pt-2.5 pb-0.5">
        {orario && (
          <span className="text-xs font-mono font-semibold" style={{ color: primary }}>{formatOra(orario)}</span>
        )}
        {p.girone && <span className="text-xs text-gray-400">Girone {p.girone}</span>}
        {showFase && (
          <span className="text-xs font-medium text-purple-500 capitalize">
            {p.fase === 'terzo_posto' ? '3°/4° posto' : p.fase}
          </span>
        )}
        {p.giocata && <span className="text-xs text-green-500">✓</span>}
      </div>
      {/* Squadre + risultato */}
      <div className="flex items-center px-3 pb-2.5 pt-1">
        <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
          <LogoSquadra squadra={p.squadra_casa!} size={30}/>
          <span className="text-xs font-medium text-gray-800 text-center leading-tight w-full px-1 line-clamp-2">
            {p.squadra_casa?.nome}
          </span>
        </div>
        <div className="flex-shrink-0 mx-3 text-center">
          {isFutura
            ? <span className="block px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-400 min-w-[52px]">vs</span>
            : <span className="block px-3 py-1.5 bg-gray-100 rounded-lg font-bold text-sm min-w-[52px]">{p.gol_casa}–{p.gol_ospite}</span>
          }
        </div>
        <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
          <LogoSquadra squadra={p.squadra_ospite!} size={30}/>
          <span className="text-xs font-medium text-gray-800 text-center leading-tight w-full px-1 line-clamp-2">
            {p.squadra_ospite?.nome}
          </span>
        </div>
      </div>
    </div>
  )
}

function SchemaQualificazione({ gironi, squadre, partite, partiteElim, nElim, primary }: {
  gironi: any[]; squadre: any[]; partite: any[]; partiteElim: any[]
  nElim: number; primary: string
}) {
  const { calcolaClassifica } = require('@/lib/types') as any
  // Non mostrare nulla se non ci sono gironi
  if (gironi.length === 0) return null

  const nPerGirone = Math.ceil(nElim / Math.max(gironi.length, 1))
  const faseLabel = nElim >= 8 ? 'Quarti di finale' : nElim >= 4 ? 'Semifinali' : 'Finale'

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2"
        style={{ background: primary + '10' }}>
        <span className="text-sm font-semibold text-gray-700">Schema qualificazione</span>
        <span className="text-xs text-gray-400 ml-auto">Le prime {nPerGirone} di ogni girone accedono ai {faseLabel}</span>
      </div>
      {/* Tabella schema testuale */}
      <div className="p-4 overflow-x-auto">
        <div className="flex gap-3 items-start flex-wrap">
          {gironi.map((g: any, gi: number) => {
            const stats = calcolaClassifica(
              squadre.filter((s: any) => s.girone_id === g.id),
              partite, g.id
            )
            return (
              <div key={g.id} className="min-w-[140px] flex-1">
                <div className="text-xs font-semibold text-gray-500 mb-2 text-center">Girone {g.nome}</div>
                {stats.slice(0, nPerGirone).map((s: any, i: number) => (
                  <div key={s.squadra.id} className="flex items-center gap-1.5 mb-1 px-2 py-1 rounded-lg"
                    style={{ background: primary + '0d' }}>
                    <span className="text-xs font-bold w-4 text-center" style={{ color: primary }}>{i+1}°</span>
                    <LogoSquadra squadra={s.squadra} size={16}/>
                    <span className="text-xs font-medium truncate">{s.squadra.nome}</span>
                    <span className="text-xs text-gray-400 ml-auto">{s.pt}pt</span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>

        {/* Bracket visivo se ci sono già gli accoppiamenti */}
        {partiteElim.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="text-xs font-semibold text-gray-500 mb-3">Accoppiamenti</div>
            <div className="flex gap-4 overflow-x-auto">
              {(['quarti','semifinale','finale','terzo_posto'] as const).map(fase => {
                const pf = partiteElim.filter((p: any) => p.fase === fase)
                if (pf.length === 0) return null
                const lbl = fase==='quarti' ? 'Quarti' : fase==='semifinale' ? 'Semifinali' : fase==='finale' ? 'Finale' : '3°/4°'
                return (
                  <div key={fase} className="flex flex-col gap-2 min-w-[150px]">
                    <div className="text-xs text-gray-400 text-center font-medium">{lbl}</div>
                    {pf.map((p: any) => (
                      <div key={p.id} className="border border-gray-200 rounded-lg overflow-hidden text-xs">
                        {[
                          { sq: p.squadra_casa, gol: p.gol_casa, win: p.giocata && (p.gol_casa??0)>(p.gol_ospite??0) },
                          { sq: p.squadra_ospite, gol: p.gol_ospite, win: p.giocata && (p.gol_ospite??0)>(p.gol_casa??0) }
                        ].map((row, i) => (
                          <div key={i} className={`flex items-center gap-1.5 px-2 py-1.5 ${i===0?'border-b border-gray-100':''}`}
                            style={row.win ? { background: primary+'0d', fontWeight: 600 } : {}}>
                            <LogoSquadra squadra={row.sq ?? { nome:'?', logo_url:null }} size={16}/>
                            <span className="flex-1 truncate">{row.sq?.nome ?? '–'}</span>
                            {p.giocata && <span className="font-bold" style={row.win ? { color: primary } : { color: '#9ca3af' }}>{row.gol}</span>}
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
