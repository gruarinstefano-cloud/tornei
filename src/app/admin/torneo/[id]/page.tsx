'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase'
import type { Torneo, Squadra, Partita, Campo, Sponsor, Girone, Pausa, CalendarioItem } from '@/lib/types'
import { calcolaClassifica, generaRoundRobin, generaCalendarioInterleaved, generaEliminatoria } from '@/lib/types'
import LogoSquadra from '@/components/LogoSquadra'
import LinkPrivatoTab from '@/components/LinkPrivatoTab'
import GironiTab from '@/components/GironiTab'
import CalendarioCampo from '@/components/CalendarioCampo'

type AdminTab = 'impostazioni' | 'gironi' | 'squadre' | 'campi' | 'calendario' | 'risultati' | 'eliminatoria' | 'banner' | 'sponsor' | 'link'

export default function AdminTorneoPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const isNuovo = id === 'nuovo'

  const [tab, setTab] = useState<AdminTab>('impostazioni')
  const [torneo, setTorneo] = useState<Partial<Torneo>>({
    nome: '', slug: '', tipo: 'gironi_eliminazione', stato: 'bozza',
    colore_primario: '#1e40af', nome_societa: '', sponsor: [],
    banner_url: null, n_squadre_eliminatoria: 4,
    finale_terzo_posto: false, durata_partita_minuti: 20,
    orario_inizio_default: '09:00', token_live: null
  })
  const [squadre, setSquadre] = useState<Squadra[]>([])
  const [campi, setCampi] = useState<Campo[]>([])
  const [gironi, setGironi] = useState<Girone[]>([])
  const [partite, setPartite] = useState<Partita[]>([])
  const [pause, setPause] = useState<Pausa[]>([])
  const [sponsors, setSponsors] = useState<Sponsor[]>([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'ok'|'err'>('ok')
  const [nuovaSquadra, setNuovaSquadra] = useState({ nome: '', girone_id: '' })
  const [nuovoCampo, setNuovoCampo] = useState({ nome: '', colore: '#3b82f6' })
  const [nuovoSponsor, setNuovoSponsor] = useState({ nome: '', sito_web: '' })
  const [generando, setGenerando] = useState(false)
  const [userId, setUserId] = useState('')
  const bannerRef = useRef<HTMLInputElement>(null)

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
        sb.from('gironi').select('*, campo:campi(*)').eq('torneo_id', id).order('ordine'),
        sb.from('partite').select('*, squadra_casa:squadre!squadra_casa_id(*), squadra_ospite:squadre!squadra_ospite_id(*), campo:campi(*)').eq('torneo_id', id).order('ordine_calendario'),
        sb.from('pause').select('*').eq('torneo_id', id).order('ordine_calendario'),
        sb.from('sponsor').select('*').eq('torneo_id', id).order('ordine'),
      ]).then(([t, sq, ca, gi, pa, pu, sp]) => {
        if (t.data) setTorneo(t.data)
        setSquadre(sq.data ?? [])
        setCampi(ca.data ?? [])
        setGironi(gi.data ?? [])
        setPartite((pa.data ?? []) as Partita[])
        setPause(pu.data ?? [])
        setSponsors(sp.data ?? [])
      })
    }
  }, [id])

  function showMsg(text: string, type: 'ok'|'err' = 'ok') {
    setMsg(text); setMsgType(type)
    setTimeout(() => setMsg(''), 3000)
  }

  // Costruisce items calendario per campo
  function buildCalendarioPerCampo(campoId: string): CalendarioItem[] {
    const pCampo = partite
      .filter(p => p.campo_id === campoId)
      .map(p => ({ kind: 'partita' as const, data: p }))
    const puCampo = pause
      .filter(p => p.campo_id === campoId)
      .map(p => ({ kind: 'pausa' as const, data: p }))
    return [...pCampo, ...puCampo].sort((a, b) => a.data.ordine_calendario - b.data.ordine_calendario)
  }

  async function handleReorder(campoId: string, items: CalendarioItem[]) {
    const sb = createClient()
    // Aggiorna ordine_calendario per partite e pause
    const updates = items.map((item, i) => ({
      id: item.data.id, ordine: i, kind: item.kind
    }))
    await Promise.all(updates.map(u =>
      u.kind === 'partita'
        ? sb.from('partite').update({ ordine_calendario: u.ordine }).eq('id', u.id)
        : sb.from('pause').update({ ordine_calendario: u.ordine }).eq('id', u.id)
    ))
    setPartite(prev => prev.map(p => {
      const u = updates.find(u => u.id === p.id && u.kind === 'partita')
      return u ? { ...p, ordine_calendario: u.ordine } : p
    }))
    setPause(prev => prev.map(p => {
      const u = updates.find(u => u.id === p.id && u.kind === 'pausa')
      return u ? { ...p, ordine_calendario: u.ordine } : p
    }))
  }

  async function addPausa(campoId: string, tipo: 'blocco' | 'separatore') {
    const sb = createClient()
    const maxOrdine = Math.max(0, ...pause.filter(p => p.campo_id === campoId).map(p => p.ordine_calendario)) + 1
    const { data } = await sb.from('pause').insert({
      torneo_id: id, campo_id: campoId, tipo,
      etichetta: tipo === 'blocco' ? 'Pausa' : '— — —',
      durata_minuti: 15, colore: '#f59e0b',
      ordine_calendario: maxOrdine
    }).select().single()
    if (data) setPause(prev => [...prev, data])
  }

  async function deletePausa(pausaId: string) {
    await createClient().from('pause').delete().eq('id', pausaId)
    setPause(prev => prev.filter(p => p.id !== pausaId))
  }

  async function updatePausa(pausaId: string, updates: Partial<Pausa>) {
    await createClient().from('pause').update(updates).eq('id', pausaId)
    setPause(prev => prev.map(p => p.id === pausaId ? { ...p, ...updates } : p))
  }

  async function saveTorneo() {
    setSaving(true)
    const sb = createClient()
    const payload = { ...torneo, admin_id: userId }
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
    const girone = gironi.find(g => g.id === nuovaSquadra.girone_id)
    const { data } = await sb.from('squadre').insert({
      nome: nuovaSquadra.nome, torneo_id: id, logo_url: null,
      girone_id: nuovaSquadra.girone_id || null,
      girone: girone?.nome || null
    }).select().single()
    if (data) { setSquadre(prev => [...prev, data]); setNuovaSquadra({ nome: '', girone_id: '' }) }
  }

  async function delSquadra(sid: string) {
    await createClient().from('squadre').delete().eq('id', sid)
    setSquadre(prev => prev.filter(s => s.id !== sid))
  }

  async function uploadLogo(squadraId: string, file: File) {
    const sb = createClient()
    const ext = file.name.split('.').pop()
    const path = `${id}/${squadraId}.${ext}`
    await sb.storage.from('loghi').upload(path, file, { upsert: true })
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

  async function generaPartiteGironi() {
    if (squadre.length < 2) { showMsg('Aggiungi almeno 2 squadre prima', 'err'); return }
    setGenerando(true)
    const sb = createClient()
    const toInsert: any[] = []
    let ordine = 0

    if (gironi.length === 0) {
      const pairs = generaCalendarioInterleaved(generaRoundRobin(squadre))
      pairs.forEach(([a, b]) => toInsert.push({
        torneo_id: id, squadra_casa_id: a.id, squadra_ospite_id: b.id,
        campo_id: null, girone_id: null,
        fase: 'campionato', girone: null, giocata: false, ordine_calendario: ordine++
      }))
    } else {
      for (const g of gironi) {
        const sq = squadre.filter(s => s.girone_id === g.id)
        if (sq.length < 2) continue
        const pairs = generaCalendarioInterleaved(generaRoundRobin(sq))
        pairs.forEach(([a, b]) => toInsert.push({
          torneo_id: id, squadra_casa_id: a.id, squadra_ospite_id: b.id,
          campo_id: g.campo_id || null, girone_id: g.id,
          fase: 'girone', girone: g.nome, giocata: false, ordine_calendario: ordine++
        }))
      }
    }

    if (toInsert.length === 0) { showMsg('Nessuna coppia generabile. Verifica i gironi.', 'err'); setGenerando(false); return }
    await sb.from('partite').delete().eq('torneo_id', id).in('fase', ['girone','campionato'])
    const { data, error } = await sb.from('partite').insert(toInsert).select('*, squadra_casa:squadre!squadra_casa_id(*), squadra_ospite:squadre!squadra_ospite_id(*), campo:campi(*)')
    if (error) showMsg('Errore: ' + error.message, 'err')
    else {
      setPartite(prev => [...prev.filter(p => !['girone','campionato'].includes(p.fase)), ...(data as Partita[])])
      showMsg(`Generate ${toInsert.length} partite con calendario ottimizzato!`)
    }
    setGenerando(false)
  }

  async function generaFaseEliminatoria() {
    const sb = createClient()
    const nElim = (torneo.n_squadre_eliminatoria as number) ?? 4
    const nPerGirone = Math.ceil(nElim / Math.max(gironi.length, 1))
    const classifiche: Record<string, any[]> = {}
    for (const g of gironi) classifiche[g.id] = calcolaClassifica(squadre, partite, g.id)
    const accoppiamenti = generaEliminatoria(gironi, classifiche, nPerGirone, torneo.finale_terzo_posto ?? false)
    if (accoppiamenti.length === 0) { showMsg('Nessun accoppiamento generabile.', 'err'); return }
    await sb.from('partite').delete().eq('torneo_id', id).in('fase', ['quarti','semifinale','finale','terzo_posto'])
    const { data, error } = await sb.from('partite').insert(
      accoppiamenti.map((a, i) => ({
        torneo_id: id, squadra_casa_id: a.casa.id, squadra_ospite_id: a.ospite.id,
        fase: a.fase, girone: null, girone_id: null, giocata: false, ordine_calendario: i
      }))
    ).select('*, squadra_casa:squadre!squadra_casa_id(*), squadra_ospite:squadre!squadra_ospite_id(*), campo:campi(*)')
    if (error) showMsg('Errore: ' + error.message, 'err')
    else {
      setPartite(prev => [...prev.filter(p => !['quarti','semifinale','finale','terzo_posto'].includes(p.fase)), ...(data as Partita[])])
      showMsg('Fase eliminatoria generata!')
    }
  }

  async function saveRisultato(p: Partita, gc: number, go: number) {
    await createClient().from('partite').update({ gol_casa: gc, gol_ospite: go, giocata: true }).eq('id', p.id)
    setPartite(prev => prev.map(x => x.id === p.id ? { ...x, gol_casa: gc, gol_ospite: go, giocata: true } : x))
    showMsg('Risultato salvato!')
  }

  async function uploadBanner(file: File) {
    const sb = createClient()
    const ext = file.name.split('.').pop()
    const path = `${id}/banner.${ext}`
    await sb.storage.from('banner').upload(path, file, { upsert: true })
    const { data: { publicUrl } } = sb.storage.from('banner').getPublicUrl(path)
    await sb.from('tornei').update({ banner_url: publicUrl }).eq('id', id)
    setTorneo(p => ({ ...p, banner_url: publicUrl }))
    showMsg('Banner caricato!')
  }

  async function addSponsor() {
    if (!nuovoSponsor.nome.trim()) return
    const sb = createClient()
    const { data } = await sb.from('sponsor').insert({
      torneo_id: id, nome: nuovoSponsor.nome, logo_url: null,
      sito_web: nuovoSponsor.sito_web || null, ordine: sponsors.length
    }).select().single()
    if (data) { setSponsors(prev => [...prev, data]); setNuovoSponsor({ nome: '', sito_web: '' }) }
  }

  async function delSponsor(sid: string) {
    await createClient().from('sponsor').delete().eq('id', sid)
    setSponsors(prev => prev.filter(s => s.id !== sid))
  }

  async function uploadLogoSponsor(sponsorId: string, file: File) {
    const sb = createClient()
    const ext = file.name.split('.').pop()
    const path = `${id}/sponsor_${sponsorId}.${ext}`
    await sb.storage.from('banner').upload(path, file, { upsert: true })
    const { data: { publicUrl } } = sb.storage.from('banner').getPublicUrl(path)
    await sb.from('sponsor').update({ logo_url: publicUrl }).eq('id', sponsorId)
    setSponsors(prev => prev.map(s => s.id === sponsorId ? { ...s, logo_url: publicUrl } : s))
    showMsg('Logo sponsor caricato!')
  }

  const partiteGirone = partite.filter(p => ['girone','campionato'].includes(p.fase))
  const partiteElim = partite.filter(p => ['quarti','semifinale','finale','terzo_posto'].includes(p.fase))

  const tabs: [AdminTab, string][] = [
    ['impostazioni','Impostazioni'], ['gironi','Gironi'], ['squadre','Squadre'],
    ['campi','Campi'], ['calendario','Calendario'], ['risultati','Risultati'],
    ['eliminatoria','Eliminatoria'], ['banner','Banner'], ['sponsor','Sponsor'], ['link','Link privato']
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
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
              className={`px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition ${tab===key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
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
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Squadre eliminatoria</label>
              <select value={torneo.n_squadre_eliminatoria}
                onChange={e => setTorneo(p => ({ ...p, n_squadre_eliminatoria: +e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value={2}>2 (solo finale)</option>
                <option value={4}>4 (semi + finale)</option>
                <option value={8}>8 (quarti + semi + finale)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Durata partita (min)</label>
              <input type="number" value={torneo.durata_partita_minuti} min={5} max={120}
                onChange={e => setTorneo(p => ({ ...p, durata_partita_minuti: +e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Orario inizio</label>
              <input type="time" value={torneo.orario_inizio_default}
                onChange={e => setTorneo(p => ({ ...p, orario_inizio_default: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"/>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <input type="checkbox" id="finale3" checked={torneo.finale_terzo_posto ?? false}
              onChange={e => setTorneo(p => ({ ...p, finale_terzo_posto: e.target.checked }))}
              className="w-4 h-4 rounded"/>
            <label htmlFor="finale3" className="text-sm text-gray-700 cursor-pointer">
              Abilita finale 3°/4° posto
            </label>
          </div>
          <button onClick={saveTorneo} disabled={saving}
            className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition">
            {saving ? 'Salvataggio...' : isNuovo ? 'Crea torneo' : 'Salva modifiche'}
          </button>
        </div>
      )}

      {/* GIRONI */}
      {tab === 'gironi' && (
        <GironiTab torneoId={id} gironi={gironi} campi={campi} squadre={squadre}
          onUpdate={(g, s) => { setGironi(g); setSquadre(s) }}/>
      )}

      {/* SQUADRE */}
      {tab === 'squadre' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex gap-2 mb-4 flex-wrap">
              <input value={nuovaSquadra.nome} onChange={e => setNuovaSquadra(p => ({ ...p, nome: e.target.value }))}
                className="flex-1 min-w-[150px] px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Nome squadra"
                onKeyDown={e => e.key === 'Enter' && addSquadra()}/>
              <select value={nuovaSquadra.girone_id} onChange={e => setNuovaSquadra(p => ({ ...p, girone_id: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="">Nessun girone</option>
                {gironi.map(g => <option key={g.id} value={g.id}>Girone {g.nome}</option>)}
              </select>
              <button onClick={addSquadra} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">Aggiungi</button>
            </div>
            {squadre.length === 0
              ? <p className="text-sm text-gray-400 text-center py-4">Nessuna squadra ancora</p>
              : squadre.map(s => <SquadraRow key={s.id} squadra={s} gironi={gironi}
                  onUpload={(f) => uploadLogo(s.id, f)} onDelete={() => delSquadra(s.id)}
                  onRinomina={async (nome) => {
                    await createClient().from('squadre').update({ nome }).eq('id', s.id)
                    setSquadre(prev => prev.map(x => x.id === s.id ? { ...x, nome } : x))
                    showMsg('Nome aggiornato!')
                  }}/>)
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
              onKeyDown={e => e.key === 'Enter' && addCampo()}/>
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

      {/* CALENDARIO DRAG & DROP */}
      {tab === 'calendario' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button onClick={generaPartiteGironi} disabled={generando}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {generando ? 'Generando...' : '⚡ Genera partite automaticamente'}
            </button>
            <span className="text-xs text-gray-400">Round-robin per girone, nessuna squadra gioca due volte di fila</span>
          </div>

          {campi.length === 0
            ? <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-200">
                Aggiungi prima i campi per visualizzare il calendario
              </div>
            : (
              <div className="grid gap-5 md:grid-cols-2">
                {campi.map(c => (
                  <CalendarioCampo key={c.id} campo={c}
                    items={buildCalendarioPerCampo(c.id)}
                    onReorder={handleReorder}
                    onAddPausa={addPausa}
                    onDeletePausa={deletePausa}
                    onUpdatePausa={updatePausa}/>
                ))}
              </div>
            )
          }

          {/* Partite non assegnate a nessun campo */}
          {partiteGirone.filter(p => !p.campo_id).length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-amber-700 mb-2">
                Partite non assegnate a nessun campo ({partiteGirone.filter(p => !p.campo_id).length})
              </p>
              <div className="space-y-1">
                {partiteGirone.filter(p => !p.campo_id).map(p => (
                  <div key={p.id} className="flex items-center gap-2 text-xs text-amber-800">
                    <span>{(p.squadra_casa as any)?.nome}</span>
                    <span>vs</span>
                    <span>{(p.squadra_ospite as any)?.nome}</span>
                    <select className="ml-auto text-xs border border-amber-300 rounded px-1 py-0.5 bg-white"
                      value="" onChange={async e => {
                        if (!e.target.value) return
                        await createClient().from('partite').update({ campo_id: e.target.value }).eq('id', p.id)
                        setPartite(prev => prev.map(x => x.id === p.id ? { ...x, campo_id: e.target.value } : x))
                      }}>
                      <option value="">Assegna campo...</option>
                      {campi.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* RISULTATI */}
      {tab === 'risultati' && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
            <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fase gironi</div>
            {partiteGirone.length === 0
              ? <p className="text-sm text-gray-400 text-center py-6">Nessuna partita ancora</p>
              : partiteGirone.map(p => <RisultatoRow key={p.id} p={p} onSave={(gc,go) => saveRisultato(p,gc,go)}/>)
            }
          </div>
          {partiteElim.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
              <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fase eliminatoria</div>
              {partiteElim.map(p => <RisultatoRow key={p.id} p={p} onSave={(gc,go) => saveRisultato(p,gc,go)}/>)}
            </div>
          )}
        </div>
      )}

      {/* ELIMINATORIA */}
      {tab === 'eliminatoria' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
            Verranno prese le prime <strong>{torneo.n_squadre_eliminatoria}</strong> squadre qualificate.
            {torneo.finale_terzo_posto && <span> Finale 3°/4° posto <strong>abilitata</strong>.</span>}
          </div>
          <button onClick={generaFaseEliminatoria}
            className="w-full py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition">
            ⚡ Genera fase eliminatoria automaticamente
          </button>
          {partiteElim.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
              <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Accoppiamenti</div>
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

      {/* BANNER */}
      {tab === 'banner' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <p className="text-xs text-gray-400">Appare in cima alla pagina pubblica. Dimensioni consigliate: 1200×300px.</p>
          {torneo.banner_url ? (
            <div className="space-y-3">
              <div className="relative w-full rounded-lg overflow-hidden border border-gray-200" style={{ height: 160 }}>
                <Image src={torneo.banner_url} alt="Banner" fill className="object-cover"/>
              </div>
              <div className="flex gap-2">
                <button onClick={() => bannerRef.current?.click()} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cambia</button>
                <button onClick={async () => { await createClient().from('tornei').update({ banner_url: null }).eq('id', id); setTorneo(p => ({ ...p, banner_url: null })) }}
                  className="px-4 py-2 border border-red-200 rounded-lg text-sm text-red-600 hover:bg-red-50">Rimuovi</button>
              </div>
            </div>
          ) : (
            <button onClick={() => bannerRef.current?.click()}
              className="w-full h-32 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-blue-400 hover:bg-blue-50 transition">
              <span className="text-2xl">🖼️</span>
              <span className="text-sm text-gray-500">Clicca per caricare il banner</span>
            </button>
          )}
          <input ref={bannerRef} type="file" accept="image/*" className="hidden"
            onChange={e => e.target.files?.[0] && uploadBanner(e.target.files[0])}/>
        </div>
      )}

      {/* SPONSOR */}
      {tab === 'sponsor' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="grid grid-cols-2 gap-2 mb-2">
              <input value={nuovoSponsor.nome} onChange={e => setNuovoSponsor(p => ({ ...p, nome: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Nome sponsor"/>
              <input value={nuovoSponsor.sito_web} onChange={e => setNuovoSponsor(p => ({ ...p, sito_web: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="https://sito.it"/>
            </div>
            <button onClick={addSponsor} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">Aggiungi sponsor</button>
          </div>
          {sponsors.map(s => (
            <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
              {s.logo_url
                ? <Image src={s.logo_url} alt={s.nome} width={60} height={28} className="object-contain max-h-7 rounded"/>
                : <div className="w-14 h-8 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-400">Logo</div>
              }
              <span className="flex-1 font-medium text-sm">{s.nome}</span>
              {s.sito_web && <span className="text-xs text-gray-400 truncate max-w-[120px]">{s.sito_web}</span>}
              <SponsorLogoUpload onUpload={(f) => uploadLogoSponsor(s.id, f)}/>
              <button onClick={() => delSponsor(s.id)} className="text-red-400 hover:text-red-600 text-xs">Rimuovi</button>
            </div>
          ))}
        </div>
      )}

      {/* LINK PRIVATO */}
      {tab === 'link' && (
        <LinkPrivatoTab
          torneoId={id}
          tokenAttuale={(torneo as any).token_live ?? null}
          onUpdate={(token) => setTorneo(p => ({ ...p, token_live: token } as any))}/>
      )}
    </div>
  )
}

function SquadraRow({ squadra, gironi, onUpload, onDelete, onRinomina }: {
  squadra: Squadra; gironi: Girone[]; onUpload: (f: File) => void; onDelete: () => void; onRinomina: (n: string) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [editing, setEditing] = useState(false)
  const [nome, setNome] = useState(squadra.nome)
  const girone = gironi.find(g => g.id === squadra.girone_id)
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <LogoSquadra squadra={squadra} size={32}/>
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex items-center gap-2">
            <input value={nome} onChange={e => setNome(e.target.value)} autoFocus
              className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
              onKeyDown={e => { if (e.key==='Enter') { onRinomina(nome); setEditing(false) } if (e.key==='Escape') setEditing(false) }}/>
            <button onClick={() => { onRinomina(nome); setEditing(false) }} className="text-green-600 text-xs font-medium">✓</button>
            <button onClick={() => setEditing(false)} className="text-gray-400 text-xs">✕</button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{squadra.nome}</span>
            {girone && <span className="text-xs text-gray-400">Girone {girone.nome}</span>}
            <button onClick={() => setEditing(true)} className="text-xs text-gray-400 hover:text-gray-600">✏️</button>
          </div>
        )}
      </div>
      <button onClick={() => ref.current?.click()} className="text-xs text-blue-600 border border-blue-200 px-2 py-1 rounded hover:bg-blue-50">
        {squadra.logo_url ? 'Cambia logo' : 'Carica logo'}
      </button>
      <input ref={ref} type="file" accept="image/*" className="hidden"
        onChange={e => e.target.files?.[0] && onUpload(e.target.files[0])}/>
      <button onClick={onDelete} className="text-red-400 hover:text-red-600 text-xs">Rimuovi</button>
    </div>
  )
}

function SponsorLogoUpload({ onUpload }: { onUpload: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <>
      <button onClick={() => ref.current?.click()} className="text-xs text-blue-600 border border-blue-200 px-2 py-1 rounded hover:bg-blue-50">Logo</button>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && onUpload(e.target.files[0])}/>
    </>
  )
}

function RisultatoRow({ p, onSave }: { p: Partita; onSave: (gc: number, go: number) => void }) {
  const [gc, setGc] = useState(p.gol_casa ?? 0)
  const [go, setGo] = useState(p.gol_ospite ?? 0)
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex items-center gap-1.5 flex-1 justify-end">
        <span className="flex-1 text-right text-sm font-medium truncate">{(p.squadra_casa as any)?.nome ?? '–'}</span>
        <LogoSquadra squadra={(p.squadra_casa as any) ?? { nome:'?', logo_url:null }} size={22}/>
      </div>
      <div className="flex items-center gap-1">
        <input type="number" min="0" max="20" value={gc} onChange={e => setGc(+e.target.value)}
          className="w-12 text-center px-1 py-1 border border-gray-300 rounded text-sm font-bold"/>
        <span className="text-gray-400">–</span>
        <input type="number" min="0" max="20" value={go} onChange={e => setGo(+e.target.value)}
          className="w-12 text-center px-1 py-1 border border-gray-300 rounded text-sm font-bold"/>
      </div>
      <div className="flex items-center gap-1.5 flex-1">
        <LogoSquadra squadra={(p.squadra_ospite as any) ?? { nome:'?', logo_url:null }} size={22}/>
        <span className="flex-1 text-sm font-medium truncate">{(p.squadra_ospite as any)?.nome ?? '–'}</span>
      </div>
      <button onClick={() => onSave(gc, go)}
        className={`flex-shrink-0 px-3 py-1 rounded text-xs font-medium ${p.giocata ? 'bg-green-100 text-green-700' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
        {p.giocata ? '✓ Agg.' : 'Salva'}
      </button>
    </div>
  )
}
