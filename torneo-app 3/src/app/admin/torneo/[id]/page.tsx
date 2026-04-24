'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { Torneo, Squadra, Partita, Campo } from '@/lib/types'
import { calcolaClassifica, generaRoundRobin, generaEliminatoria } from '@/lib/types'
import LogoSquadra from '@/components/LogoSquadra'
import LinkPrivatoTab from '@/components/LinkPrivatoTab'

type AdminTab = 'impostazioni' | 'squadre' | 'campi' | 'partite' | 'risultati' | 'eliminatoria' | 'link'

export default function AdminTorneoPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const isNuovo = id === 'nuovo'

  const [tab, setTab] = useState<AdminTab>('impostazioni')
  const [torneo, setTorneo] = useState<Partial<Torneo> & { n_squadre_eliminatoria?: number }>({
    nome: '', slug: '', tipo: 'gironi_eliminazione', stato: 'bozza',
    colore_primario: '#1e40af', nome_societa: '', sponsor: [], n_squadre_eliminatoria: 4
  })
  const [squadre, setSquadre] = useState<Squadra[]>([])
  const [campi, setCampi] = useState<Campo[]>([])
  const [partite, setPartite] = useState<Partita[]>([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'ok'|'err'>('ok')
  const [nuovaSquadra, setNuovaSquadra] = useState({ nome: '', girone: 'A' })
  const [nuovoCampo, setNuovoCampo] = useState({ nome: '', colore: '#3b82f6' })
  const [sponsorInput, setSponsorInput] = useState('')
  const [generando, setGenerando] = useState(false)
  const [userId, setUserId] = useState<string>('')

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/admin'); return }
      setUserId(user.id)
    })
    if (!isNuovo) {
      Promise.all([
        sb.from('tornei').select('*').eq('id', id).single(),
        sb.from('squadre').select('*').eq('torneo_id', id),
        sb.from('campi').select('*').eq('torneo_id', id).order('ordine'),
        sb.from('partite').select('*, squadra_casa:squadre!squadra_casa_id(*), squadra_ospite:squadre!squadra_ospite_id(*), campo:campi(nome)').eq('torneo_id', id).order('data_ora', { nullsFirst: false }),
      ]).then(([t, sq, ca, pa]) => {
        if (t.data) { setTorneo(t.data); setSponsorInput((t.data.sponsor || []).join(', ')) }
        setSquadre(sq.data ?? [])
        setCampi(ca.data ?? [])
        setPartite((pa.data ?? []) as Partita[])
      })
    }
  }, [id])

  function showMsg(text: string, type: 'ok'|'err' = 'ok') {
    setMsg(text); setMsgType(type)
    setTimeout(() => setMsg(''), 3000)
  }

  async function saveTorneo() {
    setSaving(true)
    const sb = createClient()
    const payload = {
      ...torneo,
      admin_id: userId,
      sponsor: sponsorInput.split(',').map(s => s.trim()).filter(Boolean)
    }
    if (isNuovo) {
      const { data, error } = await sb.from('tornei').insert(payload).select().single()
      if (error) showMsg('Errore: ' + error.message, 'err')
      else { showMsg('Torneo creato!'); router.push(`/admin/torneo/${data.id}`) }
    } else {
      const { error } = await sb.from('tornei').update(payload).eq('id', id)
      if (error) showMsg('Errore: ' + error.message, 'err')
      else showMsg('Salvato!')
    }
    setSaving(false)
  }

  async function addSquadra() {
    if (!nuovaSquadra.nome.trim()) return
    const sb = createClient()
    const { data } = await sb.from('squadre').insert({ ...nuovaSquadra, torneo_id: id, logo_url: null }).select().single()
    if (data) { setSquadre(prev => [...prev, data]); setNuovaSquadra({ nome: '', girone: 'A' }) }
  }

  async function delSquadra(sid: string) {
    await createClient().from('squadre').delete().eq('id', sid)
    setSquadre(prev => prev.filter(s => s.id !== sid))
  }

  async function uploadLogo(squadraId: string, file: File) {
    const sb = createClient()
    const ext = file.name.split('.').pop()
    const path = `${id}/${squadraId}.${ext}`
    const { error: upErr } = await sb.storage.from('loghi').upload(path, file, { upsert: true })
    if (upErr) { showMsg('Errore upload: ' + upErr.message, 'err'); return }
    const { data: { publicUrl } } = sb.storage.from('loghi').getPublicUrl(path)
    await sb.from('squadre').update({ logo_url: publicUrl }).eq('id', squadraId)
    setSquadre(prev => prev.map(s => s.id === squadraId ? { ...s, logo_url: publicUrl } : s))
    showMsg('Logo caricato!')
  }

  async function addCampo() {
    if (!nuovoCampo.nome.trim()) return
    const sb = createClient()
    const { data } = await sb.from('campi').insert({ ...nuovoCampo, torneo_id: id, ordine: campi.length }).select().single()
    if (data) { setCampi(prev => [...prev, data]); setNuovoCampo({ nome: '', colore: '#3b82f6' }) }
  }

  async function delCampo(cid: string) {
    await createClient().from('campi').delete().eq('id', cid)
    setCampi(prev => prev.filter(c => c.id !== cid))
  }

  // Genera automaticamente tutte le partite round-robin per ogni girone
  async function generaPartiteGironi() {
    if (squadre.length < 2) { showMsg('Aggiungi almeno 2 squadre prima', 'err'); return }
    setGenerando(true)
    const sb = createClient()
    const gironi = Array.from(new Set(squadre.map(s => s.girone).filter(Boolean))) as string[]
    const toInsert: any[] = []

    if (gironi.length === 0) {
      // Nessun girone: tutti vs tutti
      const pairs = generaRoundRobin(squadre)
      pairs.forEach(([a, b]) => toInsert.push({
        torneo_id: id, squadra_casa_id: a.id, squadra_ospite_id: b.id,
        fase: 'campionato', girone: null, giocata: false
      }))
    } else {
      for (const g of gironi) {
        const sq = squadre.filter(s => s.girone === g)
        const pairs = generaRoundRobin(sq)
        pairs.forEach(([a, b]) => toInsert.push({
          torneo_id: id, squadra_casa_id: a.id, squadra_ospite_id: b.id,
          fase: 'girone', girone: g, giocata: false
        }))
      }
    }

    // Elimina partite di girone esistenti prima di rigenerare
    await sb.from('partite').delete().eq('torneo_id', id).in('fase', ['girone','campionato'])
    const { data, error } = await sb.from('partite').insert(toInsert).select('*, squadra_casa:squadre!squadra_casa_id(*), squadra_ospite:squadre!squadra_ospite_id(*), campo:campi(nome)')
    if (error) showMsg('Errore: ' + error.message, 'err')
    else {
      setPartite(prev => [...prev.filter(p => !['girone','campionato'].includes(p.fase)), ...(data as Partita[])])
      showMsg(`Generate ${toInsert.length} partite!`)
    }
    setGenerando(false)
  }

  // Genera automaticamente gli accoppiamenti della fase eliminatoria
  async function generaFaseEliminatoria() {
    const sb = createClient()
    const gironi = Array.from(new Set(squadre.map(s => s.girone).filter(Boolean))) as string[]
    const nElim = torneo.n_squadre_eliminatoria ?? 4
    const nPerGirone = Math.ceil(nElim / Math.max(gironi.length, 1))

    const classifiche: Record<string, any[]> = {}
    for (const g of gironi) {
      classifiche[g] = calcolaClassifica(squadre, partite, g)
    }

    let accoppiamenti = generaEliminatoria(gironi.length > 0 ? gironi : [''], gironi.length > 0 ? classifiche : { '': calcolaClassifica(squadre, partite) }, nPerGirone)

    if (accoppiamenti.length === 0) { showMsg('Nessun accoppiamento generabile. Verifica le classifiche.', 'err'); return }

    // Elimina fase eliminatoria esistente
    await sb.from('partite').delete().eq('torneo_id', id).in('fase', ['quarti','semifinale','finale','terzo_posto'])

    const toInsert = accoppiamenti.map(a => ({
      torneo_id: id,
      squadra_casa_id: a.casa.id,
      squadra_ospite_id: a.ospite.id,
      fase: a.fase,
      girone: null,
      giocata: false
    }))

    const { data, error } = await sb.from('partite').insert(toInsert).select('*, squadra_casa:squadre!squadra_casa_id(*), squadra_ospite:squadre!squadra_ospite_id(*), campo:campi(nome)')
    if (error) showMsg('Errore: ' + error.message, 'err')
    else {
      setPartite(prev => [...prev.filter(p => !['quarti','semifinale','finale','terzo_posto'].includes(p.fase)), ...(data as Partita[])])
      showMsg(`Fase eliminatoria generata! ${toInsert.length} partite.`)
    }
  }

  async function saveRisultato(p: Partita, gc: number, go: number) {
    const sb = createClient()
    await sb.from('partite').update({ gol_casa: gc, gol_ospite: go, giocata: true }).eq('id', p.id)
    setPartite(prev => prev.map(x => x.id === p.id ? { ...x, gol_casa: gc, gol_ospite: go, giocata: true } : x))
    showMsg('Risultato salvato!')
  }

  async function aggiornaPartita(pid: string, updates: Partial<Partita>) {
    const sb = createClient()
    await sb.from('partite').update(updates).eq('id', pid)
    setPartite(prev => prev.map(x => x.id === pid ? { ...x, ...updates } : x))
  }

  const partiteGirone = partite.filter(p => ['girone','campionato'].includes(p.fase))
  const partiteElim = partite.filter(p => ['quarti','semifinale','finale','terzo_posto'].includes(p.fase))
  const tabs: [AdminTab, string][] = [
    ['impostazioni','Impostazioni'], ['squadre','Squadre'], ['campi','Campi'],
    ['partite','Partite'], ['risultati','Risultati'], ['eliminatoria','Eliminatoria']
  ]

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-900">{isNuovo ? 'Nuovo torneo' : torneo.nome || 'Gestisci torneo'}</h1>
        {!isNuovo && torneo.slug && (
          <Link href={`/torneo/${torneo.slug}`} target="_blank" className="ml-auto text-xs text-blue-600 border border-blue-200 px-3 py-1 rounded-lg hover:bg-blue-50">
            Vedi pubblico →
          </Link>
        )}
      </div>

      {!isNuovo && (
        <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
          {tabs.map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition ${tab===key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>
      )}

      {msg && (
        <div className={`mb-4 px-4 py-2 rounded-lg text-sm ${msgType==='err' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {msg}
        </div>
      )}

      {/* IMPOSTAZIONI */}
      {(tab === 'impostazioni' || isNuovo) && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nome torneo</label>
              <input value={torneo.nome} onChange={e => setTorneo(p => ({ ...p, nome: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Es. Torneo Estivo 2025"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Slug URL</label>
              <input value={torneo.slug} onChange={e => setTorneo(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/\s+/g,'-') }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="torneo-estivo-2025"/>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tipo torneo</label>
              <select value={torneo.tipo} onChange={e => setTorneo(p => ({ ...p, tipo: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="gironi_eliminazione">Gironi + Eliminazione</option>
                <option value="campionato_eliminazione">Campionato + Eliminazione</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Stato</label>
              <select value={torneo.stato} onChange={e => setTorneo(p => ({ ...p, stato: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="bozza">Bozza</option>
                <option value="attivo">Attivo</option>
                <option value="concluso">Concluso</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nome società</label>
              <input value={torneo.nome_societa} onChange={e => setTorneo(p => ({ ...p, nome_societa: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="ACS Calcio"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Colore primario</label>
              <div className="flex gap-2">
                <input type="color" value={torneo.colore_primario}
                  onChange={e => setTorneo(p => ({ ...p, colore_primario: e.target.value }))}
                  className="w-10 h-9 rounded border border-gray-300 cursor-pointer"/>
                <input value={torneo.colore_primario}
                  onChange={e => setTorneo(p => ({ ...p, colore_primario: e.target.value }))}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"/>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Squadre fase eliminatoria</label>
              <select value={torneo.n_squadre_eliminatoria}
                onChange={e => setTorneo(p => ({ ...p, n_squadre_eliminatoria: +e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value={2}>2 squadre (solo finale)</option>
                <option value={4}>4 squadre (semifinali + finale)</option>
                <option value={8}>8 squadre (quarti + semifinali + finale)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Sponsor (separati da virgola)</label>
              <input value={sponsorInput} onChange={e => setSponsorInput(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Sponsor A, Sponsor B"/>
            </div>
          </div>
          <button onClick={saveTorneo} disabled={saving}
            className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition">
            {saving ? 'Salvataggio...' : isNuovo ? 'Crea torneo' : 'Salva modifiche'}
          </button>
        </div>
      )}

      {/* SQUADRE */}
      {tab === 'squadre' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex gap-2 mb-4">
              <input value={nuovaSquadra.nome} onChange={e => setNuovaSquadra(p => ({ ...p, nome: e.target.value }))}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Nome squadra"
                onKeyDown={e => e.key==='Enter' && addSquadra()}/>
              <select value={nuovaSquadra.girone} onChange={e => setNuovaSquadra(p => ({ ...p, girone: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-24">
                {['A','B','C','D'].map(g => <option key={g} value={g}>Girone {g}</option>)}
              </select>
              <button onClick={addSquadra} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">Aggiungi</button>
            </div>
            {squadre.length === 0
              ? <p className="text-sm text-gray-400 text-center py-4">Nessuna squadra ancora</p>
              : squadre.map(s => (
                <SquadraRow key={s.id} squadra={s} onUpload={(f) => uploadLogo(s.id, f)} onDelete={() => delSquadra(s.id)}/>
              ))
            }
          </div>
        </div>
      )}

      {/* CAMPI */}
      {tab === 'campi' && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex gap-2 mb-3">
            <input value={nuovoCampo.nome} onChange={e => setNuovoCampo(p => ({ ...p, nome: e.target.value }))}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Es. Campo 1 — Centrale"
              onKeyDown={e => e.key==='Enter' && addCampo()}/>
            <input type="color" value={nuovoCampo.colore} onChange={e => setNuovoCampo(p => ({ ...p, colore: e.target.value }))}
              className="w-10 h-9 rounded border border-gray-300 cursor-pointer"/>
            <button onClick={addCampo} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Aggiungi</button>
          </div>
          {campi.length === 0
            ? <p className="text-sm text-gray-400 text-center py-4">Nessun campo ancora</p>
            : campi.map(c => (
              <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ background: c.colore }}/>
                  <span className="font-medium text-sm">{c.nome}</span>
                </div>
                <button onClick={() => delCampo(c.id)} className="text-red-400 hover:text-red-600 text-xs">Rimuovi</button>
              </div>
            ))
          }
        </div>
      )}

      {/* PARTITE */}
      {tab === 'partite' && (
        <div className="space-y-4">
          <div className="flex gap-3 items-center">
            <button onClick={generaPartiteGironi} disabled={generando}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {generando ? 'Generando...' : '⚡ Genera partite automaticamente'}
            </button>
            <span className="text-xs text-gray-400">Genera tutti gli incontri round-robin per ogni girone</span>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
            {partiteGirone.length === 0
              ? <p className="text-sm text-gray-400 text-center py-8">Clicca "Genera partite" per crearle automaticamente</p>
              : partiteGirone.map(p => (
                <PartitaRow key={p.id} p={p} campi={campi} onSave={(updates) => aggiornaPartita(p.id, updates)}/>
              ))
            }
          </div>
        </div>
      )}

      {/* RISULTATI */}
      {tab === 'risultati' && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
            <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fase gironi</div>
            {partiteGirone.length === 0
              ? <p className="text-sm text-gray-400 text-center py-6">Nessuna partita ancora</p>
              : partiteGirone.map(p => (
                <RisultatoRow key={p.id} p={p} onSave={(gc,go) => saveRisultato(p,gc,go)}/>
              ))
            }
          </div>
          {partiteElim.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
              <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fase eliminatoria</div>
              {partiteElim.map(p => (
                <RisultatoRow key={p.id} p={p} onSave={(gc,go) => saveRisultato(p,gc,go)}/>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ELIMINATORIA */}
      {tab === 'eliminatoria' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
            <strong>Come funziona:</strong> il sistema prende le prime <strong>{torneo.n_squadre_eliminatoria}</strong> squadre
            classificate (in base alle impostazioni) e genera automaticamente gli accoppiamenti. Assicurati che tutti i risultati
            dei gironi siano stati inseriti prima di procedere.
          </div>
          <button onClick={generaFaseEliminatoria}
            className="w-full py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition">
            ⚡ Genera fase eliminatoria automaticamente
          </button>
          {partiteElim.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
              <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Accoppiamenti generati</div>
              {partiteElim.map(p => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex items-center gap-1.5 flex-1 justify-end">
                    <LogoSquadra squadra={(p.squadra_casa as any) ?? { nome:'?', logo_url:null }} size={22}/>
                    <span className="text-sm font-medium">{(p.squadra_casa as any)?.nome ?? '–'}</span>
                  </div>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">{p.fase}</span>
                  <div className="flex items-center gap-1.5 flex-1">
                    <span className="text-sm font-medium">{(p.squadra_ospite as any)?.nome ?? '–'}</span>
                    <LogoSquadra squadra={(p.squadra_ospite as any) ?? { nome:'?', logo_url:null }} size={22}/>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* LINK PRIVATO */}
      {tab === 'link' && (
        <LinkPrivatoTab
          torneoId={id}
          tokenAttuale={(torneo as any).token_live ?? null}
          onUpdate={(token) => setTorneo(p => ({ ...p, token_live: token } as any))}
        />
      )}
    </div>
  )
}

function SquadraRow({ squadra, onUpload, onDelete }: { squadra: Squadra; onUpload: (f: File) => void; onDelete: () => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-3">
        <LogoSquadra squadra={squadra} size={32}/>
        <div>
          <span className="font-medium text-sm">{squadra.nome}</span>
          {squadra.girone && <span className="ml-2 text-xs text-gray-400">Girone {squadra.girone}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => ref.current?.click()} className="text-xs text-blue-600 border border-blue-200 px-2 py-1 rounded hover:bg-blue-50">
          {squadra.logo_url ? 'Cambia logo' : 'Carica logo'}
        </button>
        <input ref={ref} type="file" accept="image/*" className="hidden"
          onChange={e => e.target.files?.[0] && onUpload(e.target.files[0])}/>
        <button onClick={onDelete} className="text-red-400 hover:text-red-600 text-xs">Rimuovi</button>
      </div>
    </div>
  )
}

function PartitaRow({ p, campi, onSave }: { p: Partita; campi: Campo[]; onSave: (u: Partial<Partita>) => void }) {
  const [campo, setCampo] = useState(p.campo_id || '')
  const [dataOra, setDataOra] = useState(p.data_ora ? p.data_ora.slice(0,16) : '')

  async function save() {
    const sb = createClient()
    const updates = { campo_id: campo || null, data_ora: dataOra || null }
    await sb.from('partite').update(updates).eq('id', p.id)
    onSave(updates)
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 flex-wrap">
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <LogoSquadra squadra={(p.squadra_casa as any) ?? { nome:'?', logo_url:null }} size={20}/>
        <span className="text-sm font-medium truncate">{(p.squadra_casa as any)?.nome ?? '–'}</span>
      </div>
      <span className="text-xs text-gray-400">vs</span>
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <LogoSquadra squadra={(p.squadra_ospite as any) ?? { nome:'?', logo_url:null }} size={20}/>
        <span className="text-sm font-medium truncate">{(p.squadra_ospite as any)?.nome ?? '–'}</span>
      </div>
      <select value={campo} onChange={e => setCampo(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded text-xs">
        <option value="">Nessun campo</option>
        {campi.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
      </select>
      <input type="datetime-local" value={dataOra} onChange={e => setDataOra(e.target.value)}
        className="px-2 py-1.5 border border-gray-300 rounded text-xs"/>
      <button onClick={save} className="px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded text-xs font-medium">Salva</button>
    </div>
  )
}

function RisultatoRow({ p, onSave }: { p: Partita; onSave: (gc: number, go: number) => void }) {
  const [gc, setGc] = useState(p.gol_casa ?? 0)
  const [go, setGo] = useState(p.gol_ospite ?? 0)
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex items-center gap-1.5 flex-1 justify-end">
        <span className="flex-1 text-right text-sm font-medium text-gray-700 truncate">{(p.squadra_casa as any)?.nome ?? '–'}</span>
        <LogoSquadra squadra={(p.squadra_casa as any) ?? { nome:'?', logo_url:null }} size={22}/>
      </div>
      <div className="flex items-center gap-1">
        <input type="number" min="0" max="20" value={gc} onChange={e => setGc(+e.target.value)}
          className="w-12 text-center px-1 py-1 border border-gray-300 rounded text-sm font-bold"/>
        <span className="text-gray-400 text-sm">–</span>
        <input type="number" min="0" max="20" value={go} onChange={e => setGo(+e.target.value)}
          className="w-12 text-center px-1 py-1 border border-gray-300 rounded text-sm font-bold"/>
      </div>
      <div className="flex items-center gap-1.5 flex-1">
        <LogoSquadra squadra={(p.squadra_ospite as any) ?? { nome:'?', logo_url:null }} size={22}/>
        <span className="flex-1 text-sm font-medium text-gray-700 truncate">{(p.squadra_ospite as any)?.nome ?? '–'}</span>
      </div>
      <button onClick={() => onSave(gc, go)}
        className={`px-3 py-1 rounded text-xs font-medium flex-shrink-0 ${p.giocata ? 'bg-green-100 text-green-700' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
        {p.giocata ? '✓ Aggiorna' : 'Salva'}
      </button>
    </div>
  )
}
