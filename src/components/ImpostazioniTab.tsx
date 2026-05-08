'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { Torneo, Girone, Campo, Giornata } from '@/lib/types'
type GironeCampo = { id: string; girone_id: string; campo_id: string; ordine: number; campo?: Campo }
import { formatDataBreve } from '@/lib/types'

type Props = {
  torneoId: string
  isNuovo: boolean
  torneo: Partial<Torneo>
  gironi: Girone[]
  campi: Campo[]
  giornate: Giornata[]
  onTorneoChange: (t: Partial<Torneo>) => void
  onGironiChange: (g: Girone[]) => void
  onCampiChange: (c: Campo[]) => void
  onGiornateChange: (g: Giornata[]) => void
  onRenameCampo?: (campoId: string, nome: string) => void
  onSave: () => void
  saving: boolean
}

export default function ImpostazioniTab({
  torneoId, isNuovo, torneo, gironi, campi, giornate,
  onTorneoChange, onGironiChange, onCampiChange, onGiornateChange, onRenameCampo,
  onSave, saving
}: Props) {
  const [nuovoGirone, setNuovoGirone] = useState('')
  const [nuovoCampo, setNuovoCampo] = useState({ nome: '', colore: '#3b82f6' })
  const [nuovaData, setNuovaData] = useState('')
  const [msg, setMsg] = useState('')

  function showMsg(t: string) { setMsg(t); setTimeout(() => setMsg(''), 2500) }

  const sb = createClient()

  // ---- GIRONI ----
  async function addGirone() {
    if (!nuovoGirone.trim() || isNuovo) return
    const { data } = await sb.from('gironi').insert({
      torneo_id: torneoId, nome: nuovoGirone.toUpperCase().slice(0,4), ordine: gironi.length
    }).select('*, campo:campi(*)').single()
    if (data) { onGironiChange([...gironi, data]); setNuovoGirone(''); showMsg('Girone aggiunto!') }
  }

  async function delGirone(gid: string) {
    await sb.from('gironi').delete().eq('id', gid)
    onGironiChange(gironi.filter(g => g.id !== gid))
  }

  async function addGironeCampo(gironeId: string, campoId: string) {
    if (!campoId) return
    const already = gironi.find(g => g.id === gironeId)?.girone_campi?.find((gc: any) => gc.campo_id === campoId)
    if (already) return
    const girone = gironi.find(g => g.id === gironeId)
    const isFirst = !(girone?.girone_campi?.length)

    // Aggiorna campo_id legacy sul girone (questo funziona sempre)
    await sb.from('gironi').update({ campo_id: campoId }).eq('id', gironeId)

    // Prova a inserire in girone_campi (potrebbe non esistere se migration v8 non è stata eseguita)
    const { data, error } = await sb.from('girone_campi').insert({
      girone_id: gironeId, campo_id: campoId, ordine: 0
    }).select('*, campo:campi(*)').single()

    const campoObj = campi.find(c => c.id === campoId)
    const newGc = data ?? { id: campoId, girone_id: gironeId, campo_id: campoId, ordine: 0, campo: campoObj }

    onGironiChange(gironi.map(g => g.id === gironeId
      ? { ...g, campo_id: campoId, girone_campi: [...(g.girone_campi ?? []), newGc] }
      : g))
  }

  async function removeGironeCampo(gironeId: string, campoId: string) {
    await sb.from('girone_campi').delete().eq('girone_id', gironeId).eq('campo_id', campoId)
    onGironiChange(gironi.map(g => {
      if (g.id !== gironeId) return g
      const newCampi = (g.girone_campi ?? []).filter(gc => gc.campo_id !== campoId)
      const newFirst = newCampi[0]?.campo_id ?? null
      return { ...g, campo_id: newFirst, girone_campi: newCampi }
    }))
  }

  // ---- CAMPI ----
  async function addCampo() {
    if (!nuovoCampo.nome.trim() || isNuovo) return
    const { data } = await sb.from('campi').insert({
      ...nuovoCampo, torneo_id: torneoId, ordine: campi.length,
      orario_inizio: torneo.orario_inizio_default || '09:00',
      data_inizio: torneo.data_inizio || null
    }).select().single()
    if (data) { onCampiChange([...campi, data]); setNuovoCampo({ nome: '', colore: '#3b82f6' }); showMsg('Campo aggiunto!') }
  }

  async function delCampo(cid: string) {
    await sb.from('campi').delete().eq('id', cid)
    onCampiChange(campi.filter(c => c.id !== cid))
  }

  // ---- GIORNATE ----
  async function addGiornata() {
    if (!nuovaData || isNuovo) return
    const exists = giornate.find(g => g.data === nuovaData)
    if (exists) { showMsg('Data già presente'); return }
    const { data } = await sb.from('giornate').insert({
      torneo_id: torneoId, data: nuovaData, ordine: giornate.length
    }).select().single()
    if (data) {
      // Crea slot vuoti per ogni campo
      if (campi.length > 0) {
        await sb.from('slot_campo').insert(
          campi.map(c => ({ torneo_id: torneoId, giornata_id: data.id, campo_id: c.id, orario_inizio: torneo.orario_inizio_default || '09:00' }))
        )
      }
      const newG: Giornata = { ...data, slot: [] }
      onGiornateChange([...giornate, newG].sort((a,b) => a.data.localeCompare(b.data)))
      setNuovaData(''); showMsg('Giornata aggiunta!')
    }
  }

  async function delGiornata(gid: string) {
    await sb.from('giornate').delete().eq('id', gid)
    onGiornateChange(giornate.filter(g => g.id !== gid))
  }

  async function updateSlot(giornataId: string, campoId: string, orario: string) {
    // Upsert slot
    await sb.from('slot_campo').upsert({
      torneo_id: torneoId, giornata_id: giornataId, campo_id: campoId, orario_inizio: orario
    }, { onConflict: 'giornata_id,campo_id' })
    onGiornateChange(giornate.map(g => {
      if (g.id !== giornataId) return g
      const slots = g.slot ?? []
      const existing = slots.find(s => s.campo_id === campoId)
      if (existing) return { ...g, slot: slots.map(s => s.campo_id === campoId ? { ...s, orario_inizio: orario } : s) }
      return { ...g, slot: [...slots, { id: '', torneo_id: torneoId, giornata_id: giornataId, campo_id: campoId, orario_inizio: orario }] }
    }))
  }

  const inp = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
  const lbl = "block text-xs font-medium text-gray-500 mb-1"

  return (
    <div className="space-y-5">
      {msg && <div className="px-4 py-2 rounded-lg text-sm bg-green-50 text-green-700 border border-green-200">{msg}</div>}

      {/* ===== DATI TORNEO ===== */}
      <Section title="Dati torneo">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Nome torneo</label>
            <input value={torneo.nome || ''} onChange={e => onTorneoChange({ ...torneo, nome: e.target.value })}
              className={inp} placeholder="Torneo Estivo 2025"/>
          </div>
          <div>
            <label className={lbl}>Slug URL</label>
            <input value={torneo.slug || ''} onChange={e => onTorneoChange({ ...torneo, slug: e.target.value.toLowerCase().replace(/\s+/g,'-') })}
              className={inp} placeholder="torneo-estivo-2025"/>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Tipo torneo</label>
            <select value={torneo.tipo} onChange={e => onTorneoChange({ ...torneo, tipo: e.target.value as any })} className={inp}>
              <option value="gironi_eliminazione">Gironi + Eliminazione</option>
              <option value="campionato_eliminazione">Campionato + Eliminazione</option>
              <option value="solo_campionato">Solo Campionato</option>
            </select>
          </div>
          <div>
            <label className={lbl}>Stato</label>
            <select value={torneo.stato} onChange={e => onTorneoChange({ ...torneo, stato: e.target.value as any })} className={inp}>
              <option value="bozza">Bozza</option>
              <option value="attivo">Attivo</option>
              <option value="concluso">Concluso</option>
            </select>
          </div>
        </div>
        <Section title="Info pubblica">
          <div>
            <label className={lbl}>Luogo / sede dell'evento</label>
            <input value={torneo.luogo || ''} onChange={e => onTorneoChange({ ...torneo, luogo: e.target.value })}
              className={inp} placeholder="Es. Oratorio San Luigi, Via Roma 1 — Milano"/>
          </div>
          <div>
            <label className={lbl}>Testo libero (regole, benvenuto, note...)</label>
            <textarea value={torneo.info_testo || ''} onChange={e => onTorneoChange({ ...torneo, info_testo: e.target.value })}
              className={`${inp} resize-y`} rows={5}
              placeholder="Scrivi qui le regole del torneo, un messaggio di benvenuto o qualsiasi informazione utile per i partecipanti..."/>
          </div>
        </Section>

        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <input type="checkbox" id="andataRitorno" checked={torneo.andata_ritorno ?? false}
            onChange={e => onTorneoChange({ ...torneo, andata_ritorno: e.target.checked })}
            className="w-4 h-4 rounded"/>
          <div>
            <label htmlFor="andataRitorno" className="text-sm text-gray-700 cursor-pointer font-medium">
              Andata e ritorno
            </label>
            <p className="text-xs text-gray-400">Ogni coppia si affronta due volte (casa e trasferta invertite)</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Nome società</label>
            <input value={torneo.nome_societa || ''} onChange={e => onTorneoChange({ ...torneo, nome_societa: e.target.value })}
              className={inp} placeholder="ACS Calcio"/>
          </div>
          <div>
            <label className={lbl}>Colore primario</label>
            <div className="flex gap-2">
              <input type="color" value={torneo.colore_primario || '#1e40af'}
                onChange={e => onTorneoChange({ ...torneo, colore_primario: e.target.value })}
                className="w-10 h-9 rounded border border-gray-300 cursor-pointer"/>
              <input value={torneo.colore_primario || ''} onChange={e => onTorneoChange({ ...torneo, colore_primario: e.target.value })}
                className={`${inp} flex-1`}/>
            </div>
          </div>
        </div>
      </Section>

      {/* ===== DURATE & TEMPI ===== */}
      <Section title="Durate e tempi">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Durata partita — gironi (min)</label>
            <input type="number" min={5} max={120} value={torneo.durata_partita_minuti || 20}
              onChange={e => onTorneoChange({ ...torneo, durata_partita_minuti: +e.target.value })} className={inp}/>
          </div>
          <div>
            <label className={lbl}>Durata partita — eliminatoria (min)</label>
            <input type="number" min={5} max={120} value={torneo.durata_partita_eliminazione_minuti || 20}
              onChange={e => onTorneoChange({ ...torneo, durata_partita_eliminazione_minuti: +e.target.value })} className={inp}/>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Tempo tecnico cambio campo (min)</label>
            <input type="number" min={0} max={60} value={torneo.tempo_tecnico_minuti || 5}
              onChange={e => onTorneoChange({ ...torneo, tempo_tecnico_minuti: +e.target.value })} className={inp}/>
          </div>
          <div>
            <label className={lbl}>Squadre fase eliminatoria</label>
            <select value={torneo.n_squadre_eliminatoria || 4}
              onChange={e => onTorneoChange({ ...torneo, n_squadre_eliminatoria: +e.target.value })} className={inp}>
              <option value={2}>2 (solo finale)</option>
              <option value={4}>4 (semi + finale)</option>
              <option value={8}>8 (quarti + semi + finale)</option>
            </select>
          </div>
        </div>
        {torneo.tipo !== 'solo_campionato' && (
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <input type="checkbox" id="finale3" checked={torneo.finale_terzo_posto ?? false}
            onChange={e => onTorneoChange({ ...torneo, finale_terzo_posto: e.target.checked })}
            className="w-4 h-4 rounded"/>
          <label htmlFor="finale3" className="text-sm text-gray-700 cursor-pointer">
            Abilita finale 3°/4° posto
          </label>
        </div>
        )}
      </Section>

      {/* ===== GIORNATE ===== */}
      {!isNuovo && (
        <Section title="Giornate del torneo">
          <p className="text-xs text-gray-400 mb-3">
            Ogni giornata è una data di gioco. Per ogni giornata puoi impostare l'orario di inizio per ogni campo.
            Gironi e partite eliminatorie vengono assegnati alle giornate nella sezione Calendario.
          </p>
          <div className="flex gap-2 mb-4">
            <input type="date" value={nuovaData} onChange={e => setNuovaData(e.target.value)}
              className={`${inp} flex-1`}/>
            <button onClick={addGiornata} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium whitespace-nowrap">
              + Aggiungi giornata
            </button>
          </div>

          {giornate.length === 0
            ? <p className="text-sm text-gray-400 text-center py-4">Nessuna giornata ancora</p>
            : giornate.map(g => (
              <div key={g.id} className="border border-gray-200 rounded-xl mb-3 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <span className="font-semibold text-gray-800">{formatDataBreve(g.data)}</span>
                  <button onClick={() => delGiornata(g.id)} className="text-red-400 hover:text-red-600 text-xs">Elimina</button>
                </div>
                {campi.length === 0
                  ? <p className="px-4 py-3 text-sm text-gray-400">Aggiungi campi per configurare gli orari</p>
                  : (
                    <div className="divide-y divide-gray-50">
                      {campi.map(c => {
                        const slot = g.slot?.find(s => s.campo_id === c.id)
                        return (
                          <div key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.colore }}/>
                            <span className="text-sm text-gray-700 flex-1">{c.nome}</span>
                            <div className="flex items-center gap-2">
                              <label className="text-xs text-gray-400">Inizio:</label>
                              <input type="time" defaultValue={slot?.orario_inizio || torneo.orario_inizio_default || '09:00'}
                                className="px-2 py-1 border border-gray-300 rounded text-sm"
                                onBlur={e => updateSlot(g.id, c.id, e.target.value)}/>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                }
              </div>
            ))
          }
        </Section>
      )}

      {/* ===== CAMPI ===== */}
      {!isNuovo && (
        <Section title="Campi di gioco">
          <div className="flex gap-2 mb-3">
            <input value={nuovoCampo.nome} onChange={e => setNuovoCampo(p => ({ ...p, nome: e.target.value }))}
              className={`${inp} flex-1`} placeholder="Es. Campo 1 — Centrale"
              onKeyDown={e => e.key === 'Enter' && addCampo()}/>
            <input type="color" value={nuovoCampo.colore} onChange={e => setNuovoCampo(p => ({ ...p, colore: e.target.value }))}
              className="w-10 h-9 rounded border border-gray-300 cursor-pointer"/>
            <button onClick={addCampo} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">Aggiungi</button>
          </div>
          {campi.length === 0
            ? <p className="text-sm text-gray-400 text-center py-3">Nessun campo ancora</p>
            : campi.map(cc => (
              <CampoRow key={cc.id} campo={cc}
                onRename={onRenameCampo ? (nome) => onRenameCampo(cc.id, nome) : undefined}
                onDelete={() => delCampo(cc.id)}/>
            ))
          }
        </Section>
      )}

      {/* ===== GIRONI ===== */}
      {!isNuovo && (
        <Section title="Gironi">
          {(torneo.tipo === 'campionato_eliminazione' || torneo.tipo === 'solo_campionato') ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-700">
              In modalità <strong>Campionato</strong> c'è un unico girone. Aggiungi direttamente le squadre nella sezione Squadre.
            </div>
          ) : (
          <>
          <div className="flex gap-2 mb-3">
            <input value={nuovoGirone} onChange={e => setNuovoGirone(e.target.value)}
              className={`${inp} flex-1`} placeholder="Nome girone (es. A, B...)"
              onKeyDown={e => e.key === 'Enter' && addGirone()} maxLength={4}/>
            <button onClick={addGirone} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">Aggiungi</button>
          </div>
          {gironi.length === 0
            ? <p className="text-sm text-gray-400 text-center py-3">Nessun girone ancora</p>
            : gironi.map(g => (
              <div key={g.id} className="py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                  <span className="font-bold text-gray-800 w-16 flex-shrink-0">Girone {g.nome}</span>
                  {/* Assegna giornata al girone */}
                  {giornate.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs text-gray-400">Giorno:</label>
                      <select value={(g as any).giornata_id || ''}
                        onChange={async e => {
                          const gid = e.target.value || null
                          await createClient().from('gironi').update({ giornata_id: gid }).eq('id', g.id)
                          if (gid) await createClient().from('partite')
                            .update({ giornata_id: gid })
                            .eq('girone_id', g.id)
                          onGironiChange(gironi.map(x => x.id === g.id ? { ...x, giornata_id: gid } : x))
                        }}
                        className="px-2 py-1 border border-gray-300 rounded text-xs text-gray-600">
                        <option value="">Nessun giorno</option>
                        {giornate.map(gn => (
                          <option key={gn.id} value={gn.id}>{formatDataBreve(gn.data)}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {/* Campi del girone */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {(g.girone_campi ?? []).map((gc: any) => (
                      <div key={gc.campo_id} className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-lg text-xs">
                        <span className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: campi.find(cc => cc.id === gc.campo_id)?.colore ?? '#ccc' }}/>
                        <span>{campi.find(cc => cc.id === gc.campo_id)?.nome ?? '–'}</span>
                        <button onClick={() => removeGironeCampo(g.id, gc.campo_id)}
                          className="ml-1 text-gray-400 hover:text-red-500 leading-none">✕</button>
                      </div>
                    ))}
                    <select value="" onChange={e => e.target.value && addGironeCampo(g.id, e.target.value)}
                      className="px-2 py-1 border border-dashed border-gray-300 rounded text-xs text-gray-500 bg-transparent">
                      <option value="">+ Aggiungi campo...</option>
                      {campi.filter(cc => !(g.girone_campi ?? []).find(gc => gc.campo_id === cc.id))
                        .map(cc => <option key={cc.id} value={cc.id}>{cc.nome}</option>)}
                    </select>
                  </div>
                  <button onClick={() => delGirone(g.id)} className="text-red-400 hover:text-red-600 text-xs flex-shrink-0">✕</button>
                </div>
                {(g.girone_campi ?? []).length > 1 && (
                  <p className="text-xs text-blue-500 ml-20">
                    Partite distribuite automaticamente su {(g.girone_campi ?? []).length} campi
                  </p>
                )}
              </div>
            ))
          }
          </>
          )}
        </Section>
      )}

      {isNuovo && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
          Crea prima il torneo, poi potrai aggiungere campi, gironi e giornate.
        </div>
      )}

      {/* ===== FASE ELIMINATORIA ===== */}
      {!isNuovo && torneo.tipo !== 'solo_campionato' && (
        <Section title="Fase eliminatoria">
          {/* Giornata e orario */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Giornata</label>
              <select
                value={(torneo as any).giornata_eliminatoria_id || ''}
                onChange={e => onTorneoChange({ ...torneo, giornata_eliminatoria_id: e.target.value || null } as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="">Nessuna giornata</option>
                {giornate.map(g => (
                  <option key={g.id} value={g.id}>{formatDataBreve(g.data)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Orario inizio</label>
              <input type="time"
                value={(torneo as any).orario_eliminatoria || ''}
                onChange={e => onTorneoChange({ ...torneo, orario_eliminatoria: e.target.value } as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"/>
            </div>
          </div>

          {/* Schema accoppiamenti configurabile */}
          <SchemaEliminatoria torneo={torneo} gironi={gironi} onTorneoChange={onTorneoChange}/>
        </Section>
      )}

      <button onClick={onSave} disabled={saving}
        className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition">
        {saving ? 'Salvataggio...' : isNuovo ? 'Crea torneo' : 'Salva impostazioni'}
      </button>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  )
}

function CampoRow({ campo, onRename, onDelete }: {
  campo: import('@/lib/types').Campo
  onRename?: (nome: string) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [nome, setNome] = useState(campo.nome)
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 gap-2">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: campo.colore }}/>
        {editing && onRename ? (
          <div className="flex items-center gap-2 flex-1">
            <input value={nome} onChange={e => setNome(e.target.value)} autoFocus
              className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
              onKeyDown={e => { if(e.key==='Enter'){onRename(nome);setEditing(false)} if(e.key==='Escape')setEditing(false) }}/>
            <button onClick={() => { onRename(nome); setEditing(false) }} className="text-green-600 text-xs font-medium">✓</button>
            <button onClick={() => setEditing(false)} className="text-gray-400 text-xs">✕</button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-1">
            <span className="font-medium text-sm">{campo.nome}</span>
            {onRename && <button onClick={() => setEditing(true)} className="text-xs text-gray-400 hover:text-gray-600">✏️</button>}
          </div>
        )}
      </div>
      <button onClick={onDelete} className="text-red-400 hover:text-red-600 text-xs flex-shrink-0">Rimuovi</button>
    </div>
  )
}

// Tipi per lo schema configurabile
type SlotQualificata = { tipo: 'girone'; pos: number; gironeNome: string } | { tipo: 'semifinale'; n: number; esito: 'vincente' | 'perdente' }

type MatchSchema = { id: string; fase: string; casa: SlotQualificata; ospite: SlotQualificata }

function labelSlot(s: SlotQualificata): string {
  if (s.tipo === 'girone') return `${s.pos}° Girone ${s.gironeNome}`
  const faseLabel = s.n <= 4 ? `Quarto ${s.n}` : `Semifin. ${s.n - 4}`
  return `${s.esito === 'vincente' ? 'Vinc.' : 'Perd.'} ${faseLabel}`
}

function SchemaEliminatoria({ torneo, gironi, onTorneoChange }: {
  torneo: Partial<Torneo>; gironi: Girone[]; onTorneoChange: (t: Partial<Torneo>) => void
}) {
  const nElim = (torneo.n_squadre_eliminatoria as number) ?? 4
  const nPerGirone = Math.max(1, Math.ceil(nElim / Math.max(gironi.length, 1)))
  const hasQuarti = nElim >= 8
  const hasSemifin = nElim >= 4
  const hasTP = torneo.finale_terzo_posto

  // Opzioni qualificate dai gironi
  const opzioniGirone: SlotQualificata[] = []
  for (let pos = 1; pos <= nPerGirone; pos++)
    for (const g of gironi)
      opzioniGirone.push({ tipo: 'girone', pos, gironeNome: g.nome })

  // Opzioni da fasi precedenti (quarti -> semifinali, semifinali -> finale)
  const nQuarti = hasQuarti ? 4 : 0
  const nSemi = hasSemifin ? (hasQuarti ? 2 : 2) : 0
  const opzioniSemi: SlotQualificata[] = []
  // Opzioni dai quarti (se presenti)
  for (let i = 1; i <= nQuarti; i++) {
    opzioniSemi.push({ tipo: 'semifinale', n: i, esito: 'vincente' })
    opzioniSemi.push({ tipo: 'semifinale', n: i, esito: 'perdente' })
  }
  // Opzioni dalle semifinali
  for (let i = 1; i <= nSemi; i++) {
    if (!opzioniSemi.find(o => o.tipo === 'semifinale' && o.n === i && o.esito === 'vincente'))
      opzioniSemi.push({ tipo: 'semifinale', n: i, esito: 'vincente' })
    if (!opzioniSemi.find(o => o.tipo === 'semifinale' && o.n === i && o.esito === 'perdente'))
      opzioniSemi.push({ tipo: 'semifinale', n: i, esito: 'perdente' })
  }

  // Schema salvato nel torneo (JSON) o default automatico
  const schemaKey = 'schema_eliminatoria'
  const schemaRaw = (torneo as any)[schemaKey]
  
  // Default schema
  function defaultSchema(): MatchSchema[] {
    const matches: MatchSchema[] = []
    const q = [...opzioniGirone]
    const n = q.length

    if (hasQuarti) {
      // 4 quarti di finale dai gironi
      for (let i = 0; i < Math.min(4, Math.floor(n/2)); i++)
        matches.push({ id: `q${i}`, fase: 'quarti', casa: q[i], ospite: q[n-1-i] })
      // 2 semifinali: vincitori quarti
      matches.push({ id: 'sf1', fase: 'semifinale', casa: { tipo: 'semifinale', n: 1, esito: 'vincente' }, ospite: { tipo: 'semifinale', n: 2, esito: 'vincente' } })
      matches.push({ id: 'sf2', fase: 'semifinale', casa: { tipo: 'semifinale', n: 3, esito: 'vincente' }, ospite: { tipo: 'semifinale', n: 4, esito: 'vincente' } })
      // Finale: vincitori semifinali 1 e 2 (usando indici 5 e 6 per distinguere dalle semifinali quarti)
      matches.push({ id: 'finale', fase: 'finale', casa: { tipo: 'semifinale', n: 5, esito: 'vincente' }, ospite: { tipo: 'semifinale', n: 6, esito: 'vincente' } })
      if (hasTP) matches.push({ id: 'terzo', fase: 'terzo_posto', casa: { tipo: 'semifinale', n: 5, esito: 'perdente' }, ospite: { tipo: 'semifinale', n: 6, esito: 'perdente' } })
    } else if (hasSemifin) {
      // Semifinali dirette dai gironi
      for (let i = 0; i < Math.min(2, Math.floor(n/2)); i++)
        matches.push({ id: `sf${i}`, fase: 'semifinale', casa: q[i], ospite: q[n-1-i] })
      // Finale
      matches.push({ id: 'finale', fase: 'finale', casa: { tipo: 'semifinale', n: 1, esito: 'vincente' }, ospite: { tipo: 'semifinale', n: 2, esito: 'vincente' } })
      if (hasTP) matches.push({ id: 'terzo', fase: 'terzo_posto', casa: { tipo: 'semifinale', n: 1, esito: 'perdente' }, ospite: { tipo: 'semifinale', n: 2, esito: 'perdente' } })
    } else {
      // Solo finale
      if (n >= 2) matches.push({ id: 'finale', fase: 'finale', casa: q[0], ospite: q[1] })
    }
    return matches
  }

  const schema: MatchSchema[] = schemaRaw ? JSON.parse(schemaRaw) : defaultSchema()

  function save(newSchema: MatchSchema[]) {
    onTorneoChange({ ...torneo, [schemaKey]: JSON.stringify(newSchema) } as any)
  }

  function updateSlot(matchId: string, side: 'casa' | 'ospite', value: string) {
    const parsed: SlotQualificata = JSON.parse(value)
    save(schema.map(m => m.id === matchId ? { ...m, [side]: parsed } : m))
  }

  const faseLabel = (f: string) => ({ quarti:'Quarti', semifinale:'Semifinali', finale:'Finale', terzo_posto:'3°/4° posto' }[f] ?? f)
  const fasiFiltrate = [...new Set(schema.map(m => m.fase))]
  const opzioniAll = [...opzioniGirone, ...opzioniSemi]

  return (
    <div className="space-y-3 mt-1">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-medium text-gray-500">Schema accoppiamenti configurabile</label>
        <button onClick={() => save(defaultSchema())}
          className="text-xs text-blue-600 hover:underline">Ripristina default</button>
      </div>
      <p className="text-xs text-gray-400">
        I nomi delle squadre sono anonimi fino alla generazione. Puoi cambiare gli abbinamenti trascinando o usando i menu.
      </p>

      {fasiFiltrate.map(fase => (
        <div key={fase}>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{faseLabel(fase)}</div>
          <div className="space-y-1.5">
            {schema.filter(m => m.fase === fase).map((m, idx) => (
              <div key={m.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                <span className="text-xs text-gray-400 w-4 flex-shrink-0">{idx+1}</span>
                <select value={JSON.stringify(m.casa)} onChange={e => updateSlot(m.id, 'casa', e.target.value)}
                  className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs bg-white">
                  {opzioniAll.map((o,i) => (
                    <option key={i} value={JSON.stringify(o)}>{labelSlot(o)}</option>
                  ))}
                </select>
                <span className="text-xs text-gray-400 flex-shrink-0">vs</span>
                <select value={JSON.stringify(m.ospite)} onChange={e => updateSlot(m.id, 'ospite', e.target.value)}
                  className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs bg-white">
                  {opzioniAll.map((o,i) => (
                    <option key={i} value={JSON.stringify(o)}>{labelSlot(o)}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}// ===== SCHEMA ELIMINATORIA =====
// Slot: da un girone (posizione+girone) o da una partita precedente (vincente/perdente match N)
type SlotGirone = { tipo: 'girone'; pos: number; gironeNome: string }
type SlotMatch  = { tipo: 'match';  matchId: string; esito: 'vincente' | 'perdente' }
type Slot = SlotGirone | SlotMatch

interface MatchSch {
  id: string           // es. "m1", "m2"...
  label: string        // es. "Match 1"
  fase: string         // 'ottavi'|'quarti'|'semifinale'|'finale'|'terzo_posto'
  casa: Slot
  ospite: Slot
}

function labelSlot(s: Slot, schema: MatchSch[]): string {
  if (s.tipo === 'girone') {
    const suffissi: Record<number,string> = {1:'°',2:'°',3:'°'}
    return `${s.pos}${suffissi[s.pos]??'°'} Girone ${s.gironeNome}`
  }
  const m = schema.find(x => x.id === s.matchId)
  if (!m) return `? Match ${s.matchId}`
  return `${s.esito === 'vincente' ? 'Vincente' : 'Perdente'} ${m.label}`
}

function fasePrecedente(fase: string): string | null {
  const map: Record<string,string> = {
    quarti: 'ottavi', semifinale: 'quarti', finale: 'semifinale', terzo_posto: 'semifinale'
  }
  return map[fase] ?? null
}

const FASE_LABELS: Record<string,string> = {
  ottavi: 'Ottavi di finale',
  quarti: 'Quarti di finale',
  semifinale: 'Semifinali',
  finale: 'Finale',
  terzo_posto: '3°/4° posto'
}

// Determina le fasi necessarie in base a nElim
function fasiNecessarie(nElim: number, hasTP: boolean): string[] {
  if (nElim >= 16) return ['ottavi','quarti','semifinale','finale', ...(hasTP ? ['terzo_posto'] : [])]
  if (nElim >= 8)  return ['quarti','semifinale','finale', ...(hasTP ? ['terzo_posto'] : [])]
  if (nElim >= 4)  return ['semifinale','finale', ...(hasTP ? ['terzo_posto'] : [])]
  return ['finale']
}

// Genera schema default basato su gironi e posizioni
function buildDefaultSchema(
  gironi: Girone[], nElim: number, hasTP: boolean
): MatchSch[] {
  const fasi = fasiNecessarie(nElim, hasTP)
  const primaFase = fasi[0]
  const nPerGirone = Math.max(1, Math.ceil(nElim / Math.max(gironi.length, 1)))

  // Qualificate dai gironi: 1°A, 1°B, 2°A, 2°B... ordinate per accoppiamento
  const qualificate: SlotGirone[] = []
  for (let pos = 1; pos <= nPerGirone; pos++)
    for (const g of gironi)
      qualificate.push({ tipo:'girone', pos, gironeNome: g.nome })

  const schema: MatchSch[] = []
  let counter = 1

  // Prima fase: slot dai gironi
  const nPrimaFase = nElim >= 16 ? 8 : nElim >= 8 ? 4 : nElim >= 4 ? 2 : 1
  const q = [...qualificate]
  const n = q.length
  for (let i = 0; i < nPrimaFase && i < Math.floor(n/2); i++) {
    schema.push({
      id: `m${counter}`,
      label: `Match ${counter}`,
      fase: primaFase,
      casa: q[i],
      ospite: q[n-1-i]
    })
    counter++
  }

  // Fasi successive: vincenti delle partite precedenti
  let fasePrev = primaFase
  for (let fi = 1; fi < fasi.length; fi++) {
    const fase = fasi[fi]
    if (fase === 'terzo_posto') {
      // Perdenti della fase precedente alla finale
      const semiMatches = schema.filter(m => m.fase === 'semifinale')
      if (semiMatches.length >= 2) {
        schema.push({
          id: `m${counter}`, label: `Match ${counter}`, fase: 'terzo_posto',
          casa: { tipo:'match', matchId: semiMatches[0].id, esito:'perdente' },
          ospite: { tipo:'match', matchId: semiMatches[1].id, esito:'perdente' }
        })
        counter++
      }
      continue
    }
    // Partite della fase precedente
    const prevMatches = schema.filter(m => m.fase === fasePrev)
    for (let i = 0; i < Math.floor(prevMatches.length/2); i++) {
      schema.push({
        id: `m${counter}`, label: `Match ${counter}`, fase,
        casa: { tipo:'match', matchId: prevMatches[i*2].id, esito:'vincente' },
        ospite: { tipo:'match', matchId: prevMatches[i*2+1].id, esito:'vincente' }
      })
      counter++
    }
    fasePrev = fase
  }

  return schema
}

// Opzioni slot disponibili per un match in base alla sua fase
function opzioniSlot(fase: string, schema: MatchSch[], gironi: Girone[], nElim: number): Slot[] {
  const fasi = fasiNecessarie(nElim, false)
  const primaFase = fasi[0]
  const nPerGirone = Math.max(1, Math.ceil(nElim / Math.max(gironi.length, 1)))

  const opts: Slot[] = []

  // Aggiungi tutte le posizioni dai gironi come opzioni
  // (utile per la prima fase e anche come override manuale)
  const maxPos = nPerGirone + 2 // qualche posizione extra (migliori terze ecc.)
  for (let pos = 1; pos <= maxPos; pos++) {
    for (const g of gironi) {
      opts.push({ tipo:'girone', pos, gironeNome: g.nome })
    }
  }
  // "Migliori terze" generiche
  if (maxPos >= 3 && gironi.length > 2) {
    opts.push({ tipo:'girone', pos:3, gironeNome:'(migliore)' })
  }

  // Aggiungi vincenti/perdenti di partite precedenti (fasi prima di questa)
  const faseIndex = fasi.indexOf(fase)
  for (const m of schema) {
    const mFaseIndex = fasi.indexOf(m.fase)
    if (mFaseIndex < faseIndex || (fase === 'terzo_posto' && m.fase === 'semifinale')) {
      opts.push({ tipo:'match', matchId: m.id, esito:'vincente' })
      opts.push({ tipo:'match', matchId: m.id, esito:'perdente' })
    }
  }

  return opts
}

function SchemaEliminatoria({ torneo, gironi, onTorneoChange }: {
  torneo: Partial<Torneo>; gironi: Girone[]; onTorneoChange: (t: Partial<Torneo>) => void
}) {
  const nElim = (torneo.n_squadre_eliminatoria as number) ?? 4
  const hasTP = torneo.finale_terzo_posto ?? false

  const schemaRaw = (torneo as any).schema_eliminatoria
  const schema: MatchSch[] = schemaRaw
    ? (typeof schemaRaw === 'string' ? JSON.parse(schemaRaw) : schemaRaw)
    : buildDefaultSchema(gironi, nElim, hasTP)

  function save(s: MatchSch[]) {
    onTorneoChange({ ...torneo, schema_eliminatoria: JSON.stringify(s) } as any)
  }

  function updateSlot(matchId: string, side: 'casa'|'ospite', val: string) {
    save(schema.map(m => m.id === matchId ? { ...m, [side]: JSON.parse(val) } : m))
  }

  const fasi = fasiNecessarie(nElim, hasTP)
  const opts = (fase: string) => opzioniSlot(fase, schema, gironi, nElim)

  return (
    <div className="space-y-3 mt-1">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-medium text-gray-500">Schema accoppiamenti</label>
        <button onClick={() => save(buildDefaultSchema(gironi, nElim, hasTP))}
          className="text-xs text-blue-600 hover:underline">Ripristina default</button>
      </div>
      <p className="text-xs text-gray-400">
        Configura chi si affronta in ogni partita. I nomi restano anonimi fino alla generazione.
      </p>

      {fasi.map(fase => {
        const matchesFase = schema.filter(m => m.fase === fase)
        if (matchesFase.length === 0) return null
        return (
          <div key={fase}>
            <div className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gray-300 inline-block"/>
              {FASE_LABELS[fase] ?? fase}
            </div>
            <div className="space-y-2">
              {matchesFase.map(m => {
                const o = opts(fase)
                return (
                  <div key={m.id} className="bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
                    <div className="text-xs font-medium text-gray-500 mb-1.5">{m.label}</div>
                    <div className="flex flex-col gap-1.5">
                      {(['casa','ospite'] as const).map(side => (
                        <div key={side} className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 w-12 flex-shrink-0">
                            {side === 'casa' ? 'Casa' : 'Ospite'}
                          </span>
                          <select
                            value={JSON.stringify(m[side])}
                            onChange={e => updateSlot(m.id, side, e.target.value)}
                            className="flex-1 px-2 py-1 border border-gray-300 rounded-lg text-xs bg-white">
                            {o.map((opt,i) => (
                              <option key={i} value={JSON.stringify(opt)}>
                                {labelSlot(opt, schema)}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
