'use client'
import { useState, useRef } from 'react'
import type { Partita, Pausa, Campo, CalendarioItem, Giornata } from '@/lib/types'
import { calcolaOrariSlot, formatOra } from '@/lib/types'
import LogoSquadra from './LogoSquadra'

// CalendarioBoard: layout a colonne, una per campo.
// Supporta drag & drop sia all'interno di un campo (riordino)
// che tra campi diversi (spostamento campo).

type Props = {
  campi: Campo[]
  giornata: Giornata
  slotOrari: Record<string, string>   // campo_id -> HH:MM
  itemsPerCampo: Record<string, CalendarioItem[]>  // campo_id -> items
  durata: number
  durataElim: number
  tempoTecnico: number
  onReorder: (campoId: string, items: CalendarioItem[]) => void
  onMoveCampo: (partitaId: string, nuovoCampoId: string) => void
  onAddPausa: (campoId: string, tipo: 'blocco' | 'separatore') => void
  onDeletePausa: (id: string) => void
  onUpdatePausa: (id: string, u: Partial<Pausa>) => void
}

type DragState = {
  itemId: string
  fromCampoId: string
  fromIdx: number
  kind: 'partita' | 'pausa'
}

export default function CalendarioBoard({
  campi, giornata, slotOrari, itemsPerCampo,
  durata, durataElim, tempoTecnico,
  onReorder, onMoveCampo, onAddPausa, onDeletePausa, onUpdatePausa
}: Props) {
  const [drag, setDrag] = useState<DragState | null>(null)
  const [overCampo, setOverCampo] = useState<string | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)

  function handleDragStart(item: CalendarioItem, campoId: string, idx: number) {
    setDrag({ itemId: item.data.id, fromCampoId: campoId, fromIdx: idx, kind: item.kind })
  }

  function handleDragEnd() {
    if (!drag) return
    if (overCampo && overCampo !== drag.fromCampoId) {
      // Sposta su altro campo
      if (drag.kind === 'partita') {
        onMoveCampo(drag.itemId, overCampo)
      }
    } else if (overCampo === drag.fromCampoId && overIdx !== null && overIdx !== drag.fromIdx) {
      // Riordina nello stesso campo
      const items = [...(itemsPerCampo[drag.fromCampoId] ?? [])]
      const [moved] = items.splice(drag.fromIdx, 1)
      items.splice(overIdx, 0, moved)
      onReorder(drag.fromCampoId, items)
    }
    setDrag(null); setOverCampo(null); setOverIdx(null)
  }

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(campi.length, 3)}, 1fr)` }}>
      {campi.map(campo => {
        const items = itemsPerCampo[campo.id] ?? []
        const slotOrario = slotOrari[campo.id] || '09:00'
        const orariMap = calcolaOrariSlot(items, giornata.data, slotOrario, durata, durataElim, tempoTecnico)
        const isOver = overCampo === campo.id

        return (
          <div key={campo.id}
            onDragOver={e => { e.preventDefault(); setOverCampo(campo.id) }}
            onDragLeave={() => { if (overCampo === campo.id) setOverCampo(null) }}
            className={`bg-white rounded-xl border overflow-hidden transition-all ${isOver && drag && drag.fromCampoId !== campo.id ? 'border-blue-400 shadow-md' : 'border-gray-200'}`}>
            {/* Header campo */}
            <div className="px-3 py-2.5 flex items-center gap-2 border-b border-gray-100"
              style={{ background: campo.colore + '15' }}>
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: campo.colore }}/>
              <span className="font-semibold text-sm text-gray-800 flex-1 truncate">{campo.nome}</span>
              <span className="text-xs text-gray-400">{slotOrario}</span>
            </div>

            {/* Drop overlay quando si trascina da altro campo */}
            {isOver && drag && drag.fromCampoId !== campo.id && (
              <div className="px-3 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-600 text-center">
                Rilascia per spostare qui
              </div>
            )}

            {/* Lista items */}
            <div className="divide-y divide-gray-50 min-h-[48px]">
              {items.length === 0 && (
                <div className="px-3 py-4 text-center text-xs text-gray-400">
                  {isOver && drag ? '↓ Rilascia qui' : 'Nessuna partita'}
                </div>
              )}
              {items.map((item, i) => {
                const orario = item.kind === 'partita' ? orariMap.get(item.data.id) : null
                const isDragging = drag?.itemId === item.data.id
                return (
                  <div key={item.data.id}
                    draggable
                    onDragStart={() => handleDragStart(item, campo.id, i)}
                    onDragEnd={handleDragEnd}
                    onDragEnter={() => { setOverCampo(campo.id); setOverIdx(i) }}
                    onDragOver={e => e.preventDefault()}
                    className={`transition-all ${isDragging ? 'opacity-30' : ''} ${overCampo === campo.id && overIdx === i && drag && drag.fromCampoId === campo.id && !isDragging ? 'border-t-2 border-blue-400' : ''}`}
                    style={{ cursor: 'grab' }}>
                    {item.kind === 'partita'
                      ? <PartitaRow p={item.data} orario={orario}/>
                      : <PausaRow p={item.data}
                          onDelete={() => onDeletePausa(item.data.id)}
                          onUpdate={u => onUpdatePausa(item.data.id, u)}/>
                    }
                  </div>
                )
              })}
            </div>

            {/* Footer: aggiungi pausa */}
            <div className="px-3 py-2 border-t border-gray-100 flex gap-2">
              <button onClick={() => onAddPausa(campo.id, 'blocco')}
                className="text-xs px-2 py-1 border border-amber-200 text-amber-700 rounded hover:bg-amber-50 transition">
                + Pausa
              </button>
              <button onClick={() => onAddPausa(campo.id, 'separatore')}
                className="text-xs px-2 py-1 border border-gray-200 text-gray-500 rounded hover:bg-gray-50 transition">
                + Separatore
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PartitaRow({ p, orario }: { p: Partita; orario?: Date }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-2 hover:bg-gray-50 select-none">
      <span className="text-gray-300 text-xs flex-shrink-0">⠿</span>
      {orario && <span className="text-xs font-mono text-blue-600 w-9 flex-shrink-0">{formatOra(orario)}</span>}
      <div className="flex flex-col items-center gap-0.5 flex-1 min-w-0">
        <div className="flex items-center gap-1 w-full justify-center">
          <LogoSquadra squadra={(p.squadra_casa as any) ?? { nome:'?', logo_url:null }} size={16}/>
          <span className="text-xs font-medium truncate max-w-[60px]">{(p.squadra_casa as any)?.nome ?? '–'}</span>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded ${p.giocata ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {p.giocata ? `${p.gol_casa}–${p.gol_ospite}` : 'vs'}
        </span>
        <div className="flex items-center gap-1 w-full justify-center">
          <LogoSquadra squadra={(p.squadra_ospite as any) ?? { nome:'?', logo_url:null }} size={16}/>
          <span className="text-xs font-medium truncate max-w-[60px]">{(p.squadra_ospite as any)?.nome ?? '–'}</span>
        </div>
      </div>
    </div>
  )
}

function PausaRow({ p, onDelete, onUpdate }: { p: Pausa; onDelete: () => void; onUpdate: (u: Partial<Pausa>) => void }) {
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(p.etichetta)
  const [durata, setDurata] = useState(p.durata_minuti)

  if (p.tipo === 'separatore') return (
    <div className="flex items-center gap-1 px-2 py-1 select-none group">
      <span className="text-gray-300 text-xs cursor-grab">⠿</span>
      <div className="flex-1 border-t border-dashed border-gray-300"/>
      <span className="text-xs text-gray-400 px-1">{p.etichetta}</span>
      <div className="flex-1 border-t border-dashed border-gray-300"/>
      <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 text-red-400 text-xs">✕</button>
    </div>
  )

  return (
    <div className="px-2 py-1.5 select-none group" style={{ background: p.colore + '18' }}>
      <div className="flex items-center gap-1">
        <span className="text-gray-300 text-xs cursor-grab">⠿</span>
        <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: p.colore }}/>
        {editing ? (
          <>
            <input value={label} onChange={e => setLabel(e.target.value)} className="flex-1 text-xs px-1 py-0.5 border border-gray-300 rounded min-w-0"/>
            <input type="number" value={durata} onChange={e => setDurata(+e.target.value)} min={5} max={120} className="w-10 text-xs px-1 border border-gray-300 rounded text-center"/>
            <span className="text-xs text-gray-400">m</span>
            <button onClick={() => { onUpdate({ etichetta: label, durata_minuti: durata }); setEditing(false) }} className="text-green-600 text-xs">✓</button>
          </>
        ) : (
          <>
            <span className="flex-1 text-xs font-medium text-amber-800 truncate">{p.etichetta}</span>
            <span className="text-xs text-amber-600">{p.durata_minuti}m</span>
            <button onClick={() => setEditing(true)} className="opacity-0 group-hover:opacity-100 text-xs text-gray-400">✏️</button>
          </>
        )}
        <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 text-red-400 text-xs">✕</button>
      </div>
    </div>
  )
}
