'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { generaToken } from '@/lib/token'

type Props = {
  torneoId: string
  tokenAttuale: string | null
  onUpdate: (token: string | null) => void
}

export default function LinkPrivatoTab({ torneoId, tokenAttuale, onUpdate }: Props) {
  const [copying, setCopying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  const liveUrl = tokenAttuale
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/live/${tokenAttuale}`
    : null

  function showMsg(text: string) {
    setMsg(text)
    setTimeout(() => setMsg(''), 3000)
  }

  async function creaToken() {
    setLoading(true)
    const token = generaToken()
    const sb = createClient()
    const { error } = await sb.from('tornei').update({ token_live: token }).eq('id', torneoId)
    if (error) showMsg('Errore: ' + error.message)
    else { onUpdate(token); showMsg('Link creato!') }
    setLoading(false)
  }

  async function revocaToken() {
    if (!confirm('Sei sicuro? Il link attuale smetterà di funzionare immediatamente.')) return
    setLoading(true)
    const sb = createClient()
    const { error } = await sb.from('tornei').update({ token_live: null }).eq('id', torneoId)
    if (error) showMsg('Errore: ' + error.message)
    else { onUpdate(null); showMsg('Link revocato') }
    setLoading(false)
  }

  async function rigenera() {
    if (!confirm('Il vecchio link smetterà di funzionare. Continuare?')) return
    setLoading(true)
    const token = generaToken()
    const sb = createClient()
    const { error } = await sb.from('tornei').update({ token_live: token }).eq('id', torneoId)
    if (error) showMsg('Errore: ' + error.message)
    else { onUpdate(token); showMsg('Nuovo link generato!') }
    setLoading(false)
  }

  async function copiaLink() {
    if (!liveUrl) return
    await navigator.clipboard.writeText(liveUrl)
    setCopying(true)
    setTimeout(() => setCopying(false), 2000)
  }

  return (
    <div className="space-y-4">
      {msg && (
        <div className="px-4 py-2 rounded-lg text-sm bg-green-50 text-green-700 border border-green-200">{msg}</div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
        <strong>Come funziona:</strong> genera un link segreto che puoi condividere con i tuoi collaboratori.
        Chi ha il link può inserire risultati e lanciare la fase eliminatoria <strong>senza bisogno di un account</strong>.
        Puoi revocarlo e rigenerarlo in qualsiasi momento.
      </div>

      {!tokenAttuale ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
          <div className="text-4xl mb-3">🔗</div>
          <p className="text-gray-600 text-sm mb-4">Nessun link privato attivo per questo torneo</p>
          <button onClick={creaToken} disabled={loading}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition">
            {loading ? 'Generando...' : 'Genera link privato'}
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0"/>
            <span className="text-sm font-medium text-gray-700">Link attivo</span>
          </div>

          {/* URL box */}
          <div className="flex items-center gap-2">
            <div className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600 font-mono truncate">
              {liveUrl}
            </div>
            <button onClick={copiaLink}
              className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-medium border transition ${copying ? 'bg-green-50 border-green-300 text-green-700' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
              {copying ? '✓ Copiato!' : 'Copia'}
            </button>
          </div>

          {/* QR code hint */}
          <p className="text-xs text-gray-400">
            Condividi questo link con i tuoi collaboratori. Chiunque lo riceve potrà inserire risultati e lanciare la fase eliminatoria.
          </p>

          {/* Azioni */}
          <div className="flex gap-2 pt-1 border-t border-gray-100">
            <a href={liveUrl!} target="_blank"
              className="flex-1 py-2 text-center text-xs font-medium border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition">
              Apri link →
            </a>
            <button onClick={rigenera} disabled={loading}
              className="flex-1 py-2 text-xs font-medium border border-amber-300 rounded-lg text-amber-700 hover:bg-amber-50 transition disabled:opacity-50">
              Rigenera link
            </button>
            <button onClick={revocaToken} disabled={loading}
              className="flex-1 py-2 text-xs font-medium border border-red-200 rounded-lg text-red-600 hover:bg-red-50 transition disabled:opacity-50">
              Revoca link
            </button>
          </div>
        </div>
      )}

      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Cosa può fare chi ha il link</h4>
        <ul className="space-y-1.5 text-sm text-gray-600">
          <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Inserire e aggiornare risultati delle partite</li>
          <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Lanciare la fase eliminatoria</li>
          <li className="flex items-center gap-2"><span className="text-red-400">✗</span> Modificare squadre, campi o impostazioni</li>
          <li className="flex items-center gap-2"><span className="text-red-400">✗</span> Accedere ad altri tornei</li>
          <li className="flex items-center gap-2"><span className="text-red-400">✗</span> Caricare loghi o banner</li>
        </ul>
      </div>
    </div>
  )
}
