'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { Torneo, Squadra, Partita, Campo, Girone } from '@/lib/types'
import { calcolaClassifica, generaEliminatoria } from '@/lib/types'
import LogoSquadra from '@/components/LogoSquadra'

type LiveTab = 'risultati' | 'eliminatoria'

export default function LivePage() {
  const { token } = useParams<{ token: string }>()
  const [torneo, setTorneo] = useState<Torneo | null>(null)
  const [squadre, setSquadre] = useState<Squadra[]>([])
  const [partite, setPartite] = useState<Partita[]>([])
  const [campi, setCampi] = useState<Campo[]>([])
  const [gironiObj, setGironiObj] = useState<Girone[]>([])
  const [loading, setLoading] = useState(true)
  const [invalid, setInvalid] = useState(false)
  const [tab, setTab] = useState<LiveTab>('risultati')
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'ok'|'err'>('ok')
  const [generando, setGenerando] = useState(false)

  useEffect(() => {
    const sb = createClient()
    sb.from('tornei').select('*').eq('token_live', token).single()
      .then(async ({ data: t, error }) => {
        if (!t || error) { setInvalid(true); setLoading(false); return }
        setTorneo(t)
        const [sq, pa, ca, gi] = await Promise.all([
          sb.from('squadre').select('*').eq('torneo_id', t.id),
          sb.from('partite').select('*, squadra_casa:squadre!squadra_casa_id(*), squadra_ospite:squadre!squadra_ospite_id(*), campo:campi(nome)').eq('torneo_id', t.id).order('data_ora', { nullsFirst: false }),
          sb.from('campi').select('*').eq('torneo_id', t.id).order('ordine'),
          sb.from('gironi').select('*').eq('torneo_id', t.id).order('ordine'),
        ])
        setSquadre(sq.data ?? [])
        setPartite((pa.data ?? []) as Partita[])
        setCampi(ca.data ?? [])
        setGironiObj((gi as any).data ?? [])
        setLoading(false)
      })
  }, [token])

  function showMsg(text: string, type: 'ok'|'err' = 'ok') {
    setMsg(text); setMsgType(type)
    setTimeout(() => setMsg(''), 3000)
  }

  async function saveRisultato(partita: Partita, gc: number, go: number) {
    const sb = createClient()
    const { data, error } = await sb.rpc('aggiorna_risultato_con_token', {
      p_token: token,
      p_partita_id: partita.id,
      p_gol_casa: gc,
      p_gol_ospite: go,
    })
    if (error || !data?.ok) {
      showMsg(data?.error || 'Errore nel salvataggio', 'err')
    } else {
      setPartite(prev => prev.map(p => p.id === partita.id
        ? { ...p, gol_casa: gc, gol_ospite: go, giocata: true } : p))
      showMsg('Risultato salvato!')
    }
  }

  async function generaEliminatoriaLive() {
    if (!torneo) return
    setGenerando(true)
    const sb = createClient()
    const nElim = (torneo as any).n_squadre_eliminatoria ?? 4
    const nPerGirone = Math.ceil(nElim / Math.max(gironiObj.length, 1))
    const classifiche: Record<string, any[]> = {}
    for (const g of gironiObj) classifiche[g.id] = calcolaClassifica(squadre, partite, g.id)
    const finaleTP = (torneo as any).finale_terzo_posto ?? false
    const accoppiamenti = generaEliminatoria(
      gironiObj.length > 0 ? gironiObj : [{ id: '', nome: '', torneo_id: '', campo_id: null, ordine: 0 }],
      gironiObj.length > 0 ? classifiche : { '': calcolaClassifica(squadre, partite) },
      nPerGirone,
      finaleTP
    )
    if (accoppiamenti.length === 0) {
      showMsg('Nessun accoppiamento generabile. Verifica i risultati dei gironi.', 'err')
      setGenerando(false); return
    }
    const partiteJson = accoppiamenti.map(a => ({
      squadra_casa_id: a.casa.id,
      squadra_ospite_id: a.ospite.id,
      fase: a.fase,
    }))
    const { data, error } = await sb.rpc('genera_eliminatoria_con_token', {
      p_token: token,
      p_partite: partiteJson,
    })
    if (error || !data?.ok) {
      showMsg(data?.error || 'Errore nella generazione', 'err')
    } else {
      // Ricarica le partite
      const { data: pa } = await sb.from('partite')
        .select('*, squadra_casa:squadre!squadra_casa_id(*), squadra_ospite:squadre!squadra_ospite_id(*), campo:campi(nome)')
        .eq('torneo_id', torneo.id).order('data_ora', { nullsFirst: false })
      setPartite((pa ?? []) as Partita[])
      showMsg('Fase eliminatoria generata!')
      setTab('risultati')
    }
    setGenerando(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"/>
    </div>
  )

  if (invalid) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-4">🔒</div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">Link non valido</h1>
        <p className="text-gray-500 text-sm">Questo link privato non esiste o è stato revocato dall'amministratore.</p>
      </div>
    </div>
  )

  const primary = torneo!.colore_primario || '#1e40af'
  const partiteGirone = partite.filter(p => ['girone','campionato'].includes(p.fase))
  const partiteElim = partite.filter(p => ['quarti','semifinale','finale','terzo_posto'].includes(p.fase))
  const gironiCompleti = partiteGirone.length > 0 && partiteGirone.every(p => p.giocata)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="px-4 py-4" style={{ background: primary, color: '#fff' }}>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-lg flex-shrink-0">
              {(torneo!.nome_societa || torneo!.nome).slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="font-bold text-lg leading-tight">{torneo!.nome}</div>
              <div className="text-white/70 text-xs flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block"/>
                Accesso operatore — link privato
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 flex gap-1">
          {([['risultati','Risultati'],['eliminatoria','Fase eliminatoria']] as [LiveTab,string][]).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition ${tab===key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              style={tab===key ? { borderColor: primary, color: primary } : {}}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {msg && (
          <div className={`px-4 py-2.5 rounded-xl text-sm font-medium ${msgType==='err' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
            {msg}
          </div>
        )}

        {/* RISULTATI */}
        {tab === 'risultati' && (
          <div className="space-y-4">
            {/* Partite girone */}
            {partiteGirone.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
                  Fase gironi
                </div>
                {partiteGirone.map(p => (
                  <LiveRisultatoRow key={p.id} p={p} primary={primary} onSave={saveRisultato}/>
                ))}
              </div>
            )}

            {/* Partite eliminatoria */}
            {partiteElim.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
                  Fase eliminatoria
                </div>
                {partiteElim.map(p => (
                  <LiveRisultatoRow key={p.id} p={p} primary={primary} onSave={saveRisultato}/>
                ))}
              </div>
            )}

            {partiteGirone.length === 0 && partiteElim.length === 0 && (
              <div className="text-center py-12 text-gray-400">Nessuna partita ancora programmata</div>
            )}
          </div>
        )}

        {/* FASE ELIMINATORIA */}
        {tab === 'eliminatoria' && (
          <div className="space-y-4">
            {!gironiCompleti && partiteGirone.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
                ⚠️ Attenzione: non tutti i risultati dei gironi sono stati inseriti. Puoi comunque generare la fase eliminatoria, ma gli accoppiamenti si baseranno sulle classifiche attuali.
              </div>
            )}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-1">Genera fase eliminatoria</h3>
              <p className="text-sm text-gray-500 mb-4">
                Gli accoppiamenti vengono calcolati automaticamente dalle classifiche attuali. Le partite eliminatorie esistenti verranno sostituite.
              </p>
              <button onClick={generaEliminatoriaLive} disabled={generando}
                className="w-full py-3 rounded-xl text-white font-medium transition disabled:opacity-50"
                style={{ background: primary }}>
                {generando ? 'Generando...' : '⚡ Genera fase eliminatoria'}
              </button>
            </div>

            {partiteElim.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
                  Accoppiamenti attuali
                </div>
                {partiteElim.map(p => (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-1.5 flex-1 justify-end">
                      <span className="text-sm font-medium truncate">{(p.squadra_casa as any)?.nome ?? '–'}</span>
                      <LogoSquadra squadra={(p.squadra_casa as any) ?? { nome:'?', logo_url:null }} size={22}/>
                    </div>
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded">{p.fase}</span>
                    <div className="flex items-center gap-1.5 flex-1">
                      <LogoSquadra squadra={(p.squadra_ospite as any) ?? { nome:'?', logo_url:null }} size={22}/>
                      <span className="text-sm font-medium truncate">{(p.squadra_ospite as any)?.nome ?? '–'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function LiveRisultatoRow({ p, primary, onSave }: {
  p: Partita; primary: string; onSave: (p: Partita, gc: number, go: number) => void
}) {
  const [gc, setGc] = useState(p.gol_casa ?? 0)
  const [go, setGo] = useState(p.gol_ospite ?? 0)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    await onSave(p, gc, go)
    setSaving(false)
  }

  return (
    <div className="border-b border-gray-50 last:border-0 px-3 py-3">
      {(p.campo || p.girone) && (
        <div className="text-xs text-gray-400 text-center mb-1.5">
          {(p.campo as any)?.nome}{p.girone ? ` · Girone ${p.girone}` : ''}
        </div>
      )}
      <div className="flex items-center">
        {/* Squadra casa */}
        <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
          <LogoSquadra squadra={(p.squadra_casa as any) ?? { nome:'?', logo_url:null }} size={32}/>
          <span className="text-xs font-medium text-gray-800 text-center leading-tight w-full px-1 line-clamp-2">
            {(p.squadra_casa as any)?.nome ?? '–'}
          </span>
        </div>
        {/* Input risultato */}
        <div className="flex-shrink-0 mx-2 flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-1">
            <input type="number" min="0" max="20" value={gc} onChange={e => setGc(+e.target.value)}
              className="w-12 text-center px-1 py-1.5 border border-gray-300 rounded-lg text-sm font-bold focus:border-blue-400 focus:outline-none"/>
            <span className="text-gray-400 text-sm">–</span>
            <input type="number" min="0" max="20" value={go} onChange={e => setGo(+e.target.value)}
              className="w-12 text-center px-1 py-1.5 border border-gray-300 rounded-lg text-sm font-bold focus:border-blue-400 focus:outline-none"/>
          </div>
          <button onClick={handleSave} disabled={saving}
            className={`px-4 py-1 rounded-lg text-xs font-medium transition disabled:opacity-50 ${p.giocata ? 'bg-green-100 text-green-700' : 'text-white hover:opacity-90'}`}
            style={!p.giocata ? { background: primary } : {}}>
            {saving ? '...' : p.giocata ? '✓ Aggiorna' : 'Salva'}
          </button>
        </div>
        {/* Squadra ospite */}
        <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
          <LogoSquadra squadra={(p.squadra_ospite as any) ?? { nome:'?', logo_url:null }} size={32}/>
          <span className="text-xs font-medium text-gray-800 text-center leading-tight w-full px-1 line-clamp-2">
            {(p.squadra_ospite as any)?.nome ?? '–'}
          </span>
        </div>
      </div>
    </div>
  )
}
