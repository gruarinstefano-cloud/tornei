'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { Torneo, Squadra, Partita, Campo, Giornata, Girone } from '@/lib/types'
import { calcolaClassifica, generaEliminatoria, formatDataBreve } from '@/lib/types'
import LogoSquadra from './LogoSquadra'

type Props = {
  torneo: Partial<Torneo>
  squadre: Squadra[]
  gironi: Girone[]
  partite: Partita[]
  campi: Campo[]
  giornate: Giornata[]
  torneoId: string
  onPartiteChange: (partite: Partita[]) => void
}

export default function FaseFinaleTab({ torneo, squadre, gironi, partite, campi, giornate, torneoId, onPartiteChange }: Props) {
  const [generando, setGenerando] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'ok'|'err'>('ok')

  const faseFiltri = ['ottavi','quarti','semifinale','finale','terzo_posto']
  const partiteElim = partite.filter(p => faseFiltri.includes(p.fase))
  const primary = torneo.colore_primario || '#1e40af'

  function showMsg(t: string, type: 'ok'|'err' = 'ok') { setMsg(t); setMsgType(type); setTimeout(() => setMsg(''), 3000) }

  async function generaAuto() {
    setGenerando(true)
    const sb = createClient()
    const nElim = (torneo.n_squadre_eliminatoria as number) ?? 4
    const nPerGirone = Math.ceil(nElim / Math.max(gironi.length, 1))
    const classifiche: Record<string, any[]> = {}
    for (const g of gironi) classifiche[g.id] = calcolaClassifica(squadre, partite, g.id)
    const acc = generaEliminatoria(gironi, classifiche, nPerGirone, torneo.finale_terzo_posto ?? false)
    if (acc.length === 0) { showMsg('Nessun accoppiamento generabile.', 'err'); setGenerando(false); return }
    const giornataElim = (torneo as any).giornata_eliminatoria_id ?? giornate[giornate.length-1]?.id ?? null
    await sb.from('partite').delete().eq('torneo_id', torneoId).in('fase', faseFiltri)
    const { data, error } = await sb.from('partite').insert(
      acc.map((a, i) => ({ torneo_id: torneoId, squadra_casa_id: a.casa.id, squadra_ospite_id: a.ospite.id, fase: a.fase, girone: null, girone_id: null, giocata: false, ordine_calendario: i, giornata_id: giornataElim }))
    ).select('*, squadra_casa:squadre!squadra_casa_id(*), squadra_ospite:squadre!squadra_ospite_id(*), campo:campi(*)')
    if (error) showMsg('Errore: ' + error.message, 'err')
    else { onPartiteChange([...partite.filter(p => !faseFiltri.includes(p.fase)), ...(data as Partita[])]); showMsg('Fase finale generata!') }
    setGenerando(false)
  }

  async function aggiornaPartita(pid: string, updates: Partial<Partita>) {
    const sb = createClient()
    await sb.from('partite').update(updates).eq('id', pid)
    onPartiteChange(partite.map(p => p.id === pid ? { ...p, ...updates } : p))
  }

  async function eliminaPartita(pid: string) {
    await createClient().from('partite').delete().eq('id', pid)
    onPartiteChange(partite.filter(p => p.id !== pid))
  }

  const fasi = [
    { key: 'ottavi', label: 'Ottavi di finale', show: (torneo.n_squadre_eliminatoria ?? 4) >= 16 },
    { key: 'quarti', label: 'Quarti di finale', show: (torneo.n_squadre_eliminatoria ?? 4) >= 8 },
    { key: 'semifinale', label: 'Semifinali', show: (torneo.n_squadre_eliminatoria ?? 4) >= 4 },
    { key: 'finale', label: 'Finale', show: true },
    { key: 'terzo_posto', label: '3°/4° posto', show: !!torneo.finale_terzo_posto },
  ]

  return (
    <div className="space-y-4">
      {msg && <div className={`px-4 py-2 rounded-lg text-sm ${msgType==='err' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{msg}</div>}
      {fasi.filter(f => f.show).map(({ key, label }) => {
        const pf = partiteElim.filter(p => p.fase === key)
        return (
          <div key={key} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100" style={{ background: primary + '0a' }}>
              <span className="text-sm font-semibold text-gray-700">{label}</span>
            </div>
            {pf.length === 0
              ? <div className="px-4 py-4 text-sm text-gray-400 text-center">Nessuna partita per questa fase</div>
              : pf.map(p => (
                <AccoppiamentoRow key={p.id} p={p} squadre={squadre} campi={campi} giornate={giornate}
                  primary={primary}
                  onUpdate={u => aggiornaPartita(p.id, u)}
                  onDelete={() => eliminaPartita(p.id)}/>
              ))
            }
          </div>
        )
      })}
    </div>
  )
}

function AccoppiamentoRow({ p, squadre, campi, giornate, primary, onUpdate, onDelete }: {
  p: Partita; squadre: Squadra[]; campi: Campo[]; giornate: Giornata[]
  primary: string; onUpdate: (u: Partial<Partita>) => void; onDelete: () => void
}) {
  const [casa, setCasa] = useState(p.squadra_casa_id)
  const [ospite, setOspite] = useState(p.squadra_ospite_id)
  const [campo, setCampo] = useState(p.campo_id || '')
  const [giornata, setGiornata] = useState(p.giornata_id || '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    onUpdate({ squadra_casa_id: casa, squadra_ospite_id: ospite, campo_id: campo || null, giornata_id: giornata || null })
    setSaving(false)
  }

  const sqCasa = squadre.find(s => s.id === casa)
  const sqOspite = squadre.find(s => s.id === ospite)

  return (
    <div className="px-4 py-3 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center gap-1.5 flex-1 justify-end">
          {sqCasa && <LogoSquadra squadra={sqCasa} size={24}/>}
          <span className="text-sm font-medium text-gray-800 truncate">{sqCasa?.nome ?? '–'}</span>
        </div>
        <span className={`px-3 py-1 rounded-lg text-xs font-bold min-w-[48px] text-center ${p.giocata ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {p.giocata ? `${p.gol_casa}–${p.gol_ospite}` : 'vs'}
        </span>
        <div className="flex items-center gap-1.5 flex-1">
          <span className="text-sm font-medium text-gray-800 truncate">{sqOspite?.nome ?? '–'}</span>
          {sqOspite && <LogoSquadra squadra={sqOspite} size={24}/>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Squadra casa</label>
          <select value={casa} onChange={e => setCasa(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs">
            {squadre.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Squadra ospite</label>
          <select value={ospite} onChange={e => setOspite(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs">
            {squadre.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Campo</label>
          <select value={campo} onChange={e => setCampo(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs">
            <option value="">Nessun campo</option>
            {campi.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Giornata</label>
          <select value={giornata} onChange={e => setGiornata(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs">
            <option value="">Nessuna</option>
            {giornate.map(g => <option key={g.id} value={g.id}>{formatDataBreve(g.data)}</option>)}
          </select>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50">{saving ? '...' : 'Salva'}</button>
        <button onClick={onDelete} className="px-3 py-1.5 border border-red-200 text-red-500 rounded text-xs hover:bg-red-50">Elimina</button>
      </div>
    </div>
  )
}
