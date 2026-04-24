'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { Girone, Campo, Squadra } from '@/lib/types'

type Props = {
  torneoId: string
  gironi: Girone[]
  campi: Campo[]
  squadre: Squadra[]
  onUpdate: (gironi: Girone[], squadre: Squadra[]) => void
}

export default function GironiTab({ torneoId, gironi, campi, squadre, onUpdate }: Props) {
  const [nuovoNome, setNuovoNome] = useState('')
  const [msg, setMsg] = useState('')

  function showMsg(t: string) { setMsg(t); setTimeout(() => setMsg(''), 2500) }

  async function addGirone() {
    if (!nuovoNome.trim()) return
    const sb = createClient()
    const { data } = await sb.from('gironi').insert({
      torneo_id: torneoId, nome: nuovoNome.toUpperCase(), ordine: gironi.length
    }).select('*, campo:campi(*)').single()
    if (data) { onUpdate([...gironi, data], squadre); setNuovoNome('') }
  }

  async function delGirone(gid: string) {
    if (!confirm('Elimina il girone? Le squadre associate resteranno senza girone.')) return
    await createClient().from('gironi').delete().eq('id', gid)
    onUpdate(gironi.filter(g => g.id !== gid), squadre.map(s => s.girone_id === gid ? { ...s, girone_id: null, girone: null } : s))
  }

  async function assegnaCampo(gironeId: string, campoId: string | null) {
    const sb = createClient()
    await sb.from('gironi').update({ campo_id: campoId || null }).eq('id', gironeId)
    onUpdate(gironi.map(g => g.id === gironeId ? { ...g, campo_id: campoId || null, campo: campi.find(c => c.id === campoId) } : g), squadre)
  }

  async function assegnaSquadra(squadraId: string, gironeId: string | null) {
    const sb = createClient()
    const girone = gironi.find(g => g.id === gironeId)
    await sb.from('squadre').update({ girone_id: gironeId || null, girone: girone?.nome || null }).eq('id', squadraId)
    onUpdate(gironi, squadre.map(s => s.id === squadraId ? { ...s, girone_id: gironeId, girone: girone?.nome || null } : s))
    showMsg('Squadra spostata!')
  }

  async function rinominaSquadra(squadraId: string, nome: string) {
    if (!nome.trim()) return
    await createClient().from('squadre').update({ nome }).eq('id', squadraId)
    onUpdate(gironi, squadre.map(s => s.id === squadraId ? { ...s, nome } : s))
    showMsg('Nome aggiornato!')
  }

  const squadreSenzaGirone = squadre.filter(s => !s.girone_id)

  return (
    <div className="space-y-4">
      {msg && <div className="px-4 py-2 rounded-lg text-sm bg-green-50 text-green-700 border border-green-200">{msg}</div>}

      {/* Aggiungi girone */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex gap-2">
          <input value={nuovoNome} onChange={e => setNuovoNome(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Nome girone (es. A, B, C...)"
            onKeyDown={e => e.key === 'Enter' && addGirone()} maxLength={10}/>
          <button onClick={addGirone} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
            + Aggiungi girone
          </button>
        </div>
      </div>

      {/* Gironi configurati */}
      {gironi.length === 0
        ? <div className="text-center py-8 text-gray-400 text-sm">Nessun girone ancora. Aggiungine uno sopra.</div>
        : gironi.map(g => (
          <div key={g.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-3 border-b border-gray-100 bg-gray-50">
              <span className="font-bold text-gray-800">Girone {g.nome}</span>
              <div className="flex items-center gap-2 ml-auto">
                <label className="text-xs text-gray-500">Campo:</label>
                <select value={g.campo_id || ''} onChange={e => assegnaCampo(g.id, e.target.value)}
                  className="px-2 py-1 border border-gray-300 rounded text-xs">
                  <option value="">Nessun campo</option>
                  {campi.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
                <button onClick={() => delGirone(g.id)} className="text-red-400 hover:text-red-600 text-xs ml-2">Elimina</button>
              </div>
            </div>

            {/* Squadre del girone */}
            <div className="divide-y divide-gray-50">
              {squadre.filter(s => s.girone_id === g.id).length === 0
                ? <div className="px-4 py-3 text-sm text-gray-400 italic">Nessuna squadra assegnata</div>
                : squadre.filter(s => s.girone_id === g.id).map(s => (
                  <SquadraGironeRow key={s.id} squadra={s} gironi={gironi} currentGironeId={g.id}
                    onAssegna={(gid) => assegnaSquadra(s.id, gid)}
                    onRinomina={(nome) => rinominaSquadra(s.id, nome)}/>
                ))
              }
            </div>

            {/* Squadre senza girone da assegnare */}
            {squadreSenzaGirone.length > 0 && (
              <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-400">Aggiungi:</span>
                {squadreSenzaGirone.map(s => (
                  <button key={s.id} onClick={() => assegnaSquadra(s.id, g.id)}
                    className="text-xs px-2 py-1 bg-white border border-gray-300 rounded hover:border-blue-400 hover:text-blue-600 transition">
                    {s.nome} +
                  </button>
                ))}
              </div>
            )}
          </div>
        ))
      }

      {/* Squadre senza girone */}
      {squadreSenzaGirone.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-amber-700 mb-2">Squadre senza girone ({squadreSenzaGirone.length})</p>
          <div className="flex flex-wrap gap-2">
            {squadreSenzaGirone.map(s => (
              <span key={s.id} className="text-xs px-2 py-1 bg-white border border-amber-200 rounded text-amber-800">{s.nome}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SquadraGironeRow({ squadra, gironi, currentGironeId, onAssegna, onRinomina }: {
  squadra: Squadra; gironi: Girone[]; currentGironeId: string
  onAssegna: (gironeId: string | null) => void; onRinomina: (nome: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [nome, setNome] = useState(squadra.nome)

  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      {squadra.logo_url
        ? <img src={squadra.logo_url} alt={squadra.nome} className="w-6 h-6 rounded-full object-cover flex-shrink-0"/>
        : <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-500 flex-shrink-0 font-medium">
            {squadra.nome.slice(0,2).toUpperCase()}
          </div>
      }
      {editing ? (
        <>
          <input value={nome} onChange={e => setNome(e.target.value)} autoFocus
            className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
            onKeyDown={e => { if (e.key === 'Enter') { onRinomina(nome); setEditing(false) } if (e.key === 'Escape') setEditing(false) }}/>
          <button onClick={() => { onRinomina(nome); setEditing(false) }} className="text-green-600 text-xs font-medium">✓</button>
          <button onClick={() => setEditing(false)} className="text-gray-400 text-xs">✕</button>
        </>
      ) : (
        <>
          <span className="flex-1 text-sm font-medium text-gray-800">{squadra.nome}</span>
          <button onClick={() => setEditing(true)} className="text-xs text-gray-400 hover:text-gray-600">✏️</button>
          <select value={currentGironeId} onChange={e => onAssegna(e.target.value || null)}
            className="text-xs px-2 py-1 border border-gray-200 rounded text-gray-500">
            <option value="">Senza girone</option>
            {gironi.map(g => <option key={g.id} value={g.id}>Girone {g.nome}</option>)}
          </select>
        </>
      )}
    </div>
  )
}
