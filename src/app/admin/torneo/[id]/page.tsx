'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { Torneo, Squadra, Partita, Campo } from '@/lib/types'

type AdminTab = 'impostazioni' | 'squadre' | 'campi' | 'partite' | 'risultati'

export default function AdminTorneoPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const isNuovo = id === 'nuovo'

  const [tab, setTab] = useState<AdminTab>('impostazioni')
  const [torneo, setTorneo] = useState<Partial<Torneo>>({
    nome: '', slug: '', tipo: 'gironi_eliminazione', stato: 'bozza',
    colore_primario: '#1e40af', nome_societa: '', sponsor: []
  })
  const [squadre, setSquadre] = useState<Squadra[]>([])
  const [campi, setCampi] = useState<Campo[]>([])
  const [partite, setPartite] = useState<Partita[]>([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [nuovaSquadra, setNuovaSquadra] = useState({ nome: '', girone: 'A' })
  const [nuovoCampo, setNuovoCampo] = useState({ nome: '', colore: '#3b82f6' })
  const [sponsorInput, setSponsorInput] = useState('')

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(({ data: { user } }) => { if (!user) router.push('/admin') })
    if (!isNuovo) {
      Promise.all([
        sb.from('tornei').select('*').eq('id', id).single(),
        sb.from('squadre').select('*').eq('torneo_id', id),
        sb.from('campi').select('*').eq('torneo_id', id).order('ordine'),
        sb.from('partite').select('*, squadra_casa:squadre!squadra_casa_id(nome), squadra_ospite:squadre!squadra_ospite_id(nome), campo:campi(nome)').eq('torneo_id', id).order('data_ora'),
      ]).then(([t, sq, ca, pa]) => {
        if (t.data) { setTorneo(t.data); setSponsorInput((t.data.sponsor || []).join(', ')) }
        setSquadre(sq.data ?? [])
        setCampi(ca.data ?? [])
        setPartite((pa.data ?? []) as Partita[])
      })
    }
  }, [id])

  async function saveTorneo() {
    setSaving(true)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return
    const payload = { ...torneo, admin_id: user.id, sponsor: sponsorInput.split(',').map(s => s.trim()).filter(Boolean) }
    if (isNuovo) {
      const { data, error } = await sb.from('tornei').insert(payload).select().single()
      if (error) setMsg('Errore: ' + error.message)
      else { setMsg('Torneo creato!'); router.push(`/admin/torneo/${data.id}`) }
    } else {
      const { error } = await sb.from('tornei').update(payload).eq('id', id)
      if (error) setMsg('Errore: ' + error.message)
      else setMsg('Salvato!')
    }
    setSaving(false)
    setTimeout(() => setMsg(''), 3000)
  }

  async function addSquadra() {
    if (!nuovaSquadra.nome.trim()) return
    const sb = createClient()
    const { data } = await sb.from('squadre').insert({ ...nuovaSquadra, torneo_id: id }).select().single()
    if (data) { setSquadre(prev => [...prev, data]); setNuovaSquadra({ nome: '', girone: 'A' }) }
  }

  async function delSquadra(sid: string) {
    await createClient().from('squadre').delete().eq('id', sid)
    setSquadre(prev => prev.filter(s => s.id !== sid))
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

  async function addPartita() {
    if (squadre.length < 2) { setMsg('Aggiungi prima almeno 2 squadre'); return }
    const sb = createClient()
    const payload = {
      torneo_id: id,
      squadra_casa_id: squadre[0].id,
      squadra_ospite_id: squadre[1].id,
      fase: torneo.tipo === 'gironi_eliminazione' ? 'girone' : 'campionato',
      girone: torneo.tipo === 'gironi_eliminazione' ? squadre[0].girone : null,
      giocata: false
    }
    const { data } = await sb.from('partite').insert(payload).select('*, squadra_casa:squadre!squadra_casa_id(nome), squadra_ospite:squadre!squadra_ospite_id(nome), campo:campi(nome)').single()
    if (data) setPartite(prev => [...prev, data as Partita])
  }

  async function saveRisultato(p: Partita, gc: number, go: number) {
    const sb = createClient()
    await sb.from('partite').update({ gol_casa: gc, gol_ospite: go, giocata: true }).eq('id', p.id)
    setPartite(prev => prev.map(x => x.id === p.id ? { ...x, gol_casa: gc, gol_ospite: go, giocata: true } : x))
    setMsg('Risultato salvato!')
    setTimeout(() => setMsg(''), 2000)
  }

  const tabs: [AdminTab, string][] = [
    ['impostazioni','Impostazioni'], ['squadre','Squadre'], ['campi','Campi'],
    ['partite','Partite'], ['risultati','Risultati']
  ]

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-900">{isNuovo ? 'Nuovo torneo' : torneo.nome || 'Gestisci torneo'}</h1>
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

      {msg && <div className={`mb-4 px-4 py-2 rounded-lg text-sm ${msg.includes('Errore') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{msg}</div>}

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
                <input type="color" value={torneo.colore_primario} onChange={e => setTorneo(p => ({ ...p, colore_primario: e.target.value }))}
                  className="w-10 h-9 rounded border border-gray-300 cursor-pointer"/>
                <input value={torneo.colore_primario} onChange={e => setTorneo(p => ({ ...p, colore_primario: e.target.value }))}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"/>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Sponsor (separati da virgola)</label>
            <input value={sponsorInput} onChange={e => setSponsorInput(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Sponsor A, Sponsor B"/>
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
            <div className="flex gap-2 mb-3">
              <input value={nuovaSquadra.nome} onChange={e => setNuovaSquadra(p => ({ ...p, nome: e.target.value }))}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Nome squadra"
                onKeyDown={e => e.key === 'Enter' && addSquadra()}/>
              <select value={nuovaSquadra.girone} onChange={e => setNuovaSquadra(p => ({ ...p, girone: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-24">
                {['A','B','C','D'].map(g => <option key={g} value={g}>Girone {g}</option>)}
              </select>
              <button onClick={addSquadra} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Aggiungi</button>
            </div>
            {squadre.length === 0
              ? <p className="text-sm text-gray-400 text-center py-4">Nessuna squadra ancora</p>
              : squadre.map(s => (
                <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div><span className="font-medium text-sm">{s.nome}</span>{s.girone && <span className="ml-2 text-xs text-gray-400">Girone {s.girone}</span>}</div>
                  <button onClick={() => delSquadra(s.id)} className="text-red-400 hover:text-red-600 text-xs">Rimuovi</button>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* CAMPI */}
      {tab === 'campi' && (
        <div className="space-y-4">
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
        </div>
      )}

      {/* PARTITE */}
      {tab === 'partite' && (
        <div className="space-y-4">
          <button onClick={addPartita} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">+ Aggiungi partita</button>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
            {partite.length === 0
              ? <p className="text-sm text-gray-400 text-center py-8">Nessuna partita ancora</p>
              : partite.map(p => (
                <PartitaRow key={p.id} p={p} squadre={squadre} campi={campi}
                  onSave={(updated) => setPartite(prev => prev.map(x => x.id === updated.id ? updated : x))}/>
              ))
            }
          </div>
        </div>
      )}

      {/* RISULTATI */}
      {tab === 'risultati' && (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
          {partite.length === 0
            ? <p className="text-sm text-gray-400 text-center py-8">Nessuna partita ancora</p>
            : partite.map(p => (
              <RisultatoRow key={p.id} p={p} onSave={(gc, go) => saveRisultato(p, gc, go)}/>
            ))
          }
        </div>
      )}
    </div>
  )
}

function PartitaRow({ p, squadre, campi, onSave }: { p: Partita, squadre: Squadra[], campi: Campo[], onSave: (p: Partita) => void }) {
  const [casa, setCasa] = useState(p.squadra_casa_id)
  const [ospite, setOspite] = useState(p.squadra_ospite_id)
  const [campo, setCampo] = useState(p.campo_id || '')
  const [fase, setFase] = useState(p.fase)
  const [dataOra, setDataOra] = useState(p.data_ora ? p.data_ora.slice(0,16) : '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const sb = createClient()
    const payload = { squadra_casa_id: casa, squadra_ospite_id: ospite, campo_id: campo || null, fase, data_ora: dataOra || null }
    await sb.from('partite').update(payload).eq('id', p.id)
    onSave({ ...p, ...payload })
    setSaving(false)
  }

  return (
    <div className="p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <select value={casa} onChange={e => setCasa(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded text-sm">
          {squadre.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>
        <select value={ospite} onChange={e => setOspite(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded text-sm">
          {squadre.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <select value={campo} onChange={e => setCampo(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded text-sm">
          <option value="">Nessun campo</option>
          {campi.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <select value={fase} onChange={e => setFase(e.target.value as any)} className="px-2 py-1.5 border border-gray-300 rounded text-sm">
          {(['girone','campionato','quarti','semifinale','finale','terzo_posto'] as const).map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <input type="datetime-local" value={dataOra} onChange={e => setDataOra(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded text-sm"/>
      </div>
      <button onClick={save} disabled={saving} className="px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded text-xs font-medium">
        {saving ? '...' : 'Salva'}
      </button>
    </div>
  )
}

function RisultatoRow({ p, onSave }: { p: Partita, onSave: (gc: number, go: number) => void }) {
  const [gc, setGc] = useState(p.gol_casa ?? 0)
  const [go, setGo] = useState(p.gol_ospite ?? 0)

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="flex-1 text-right text-sm font-medium text-gray-700">{(p.squadra_casa as any)?.nome ?? '–'}</span>
      <div className="flex items-center gap-1">
        <input type="number" min="0" max="20" value={gc} onChange={e => setGc(+e.target.value)}
          className="w-12 text-center px-1 py-1 border border-gray-300 rounded text-sm font-bold"/>
        <span className="text-gray-400 text-sm">–</span>
        <input type="number" min="0" max="20" value={go} onChange={e => setGo(+e.target.value)}
          className="w-12 text-center px-1 py-1 border border-gray-300 rounded text-sm font-bold"/>
      </div>
      <span className="flex-1 text-sm font-medium text-gray-700">{(p.squadra_ospite as any)?.nome ?? '–'}</span>
      <button onClick={() => onSave(gc, go)}
        className={`px-3 py-1 rounded text-xs font-medium ${p.giocata ? 'bg-green-100 text-green-700' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
        {p.giocata ? 'Aggiorna' : 'Salva'}
      </button>
    </div>
  )
}
