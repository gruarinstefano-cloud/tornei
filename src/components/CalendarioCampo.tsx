'use client'
import { useState, useRef } from 'react'
import type { Partita, Pausa, Campo, CalendarioItem, Giornata } from '@/lib/types'
import { calcolaOrariSlot, formatOra } from '@/lib/types'
import LogoSquadra from './LogoSquadra'

type Props = {
  campo: Campo
  giornata: Giornata
  slotOrario: string          // HH:MM orario inizio per questo campo in questa giornata
  items: CalendarioItem[]
  durata: number
  durataElim: number
  tempoTecnico: number
  onReorder: (items: CalendarioItem[]) => void
  onAddPausa: (tipo: 'blocco' | 'separatore') => void
  onDeletePausa: (id: string) => void
  onUpdatePausa: (id: string, u: Partial<Pausa>) => void
}

export default function CalendarioCampo({ campo, giornata, slotOrario, items, durata, durataElim, tempoTecnico, onReorder, onAddPausa, onDeletePausa, onUpdatePausa }: Props) {
  const [dragIdx, setDragIdx] = useState<number|null>(null)
  const [overIdx, setOverIdx] = useState<number|null>(null)
  const dragItem = useRef<number|null>(null)

  // Calcola orari per tutti gli item
  const orariMap = calcolaOrariSlot(items, giornata.data, slotOrario, durata, durataElim, tempoTecnico)

  function handleDragStart(i: number) { dragItem.current = i; setDragIdx(i) }
  function handleDragEnter(i: number) { setOverIdx(i) }
  function handleDragEnd() {
    if (dragItem.current === null || overIdx === null || dragItem.current === overIdx) {
      setDragIdx(null); setOverIdx(null); dragItem.current = null; return
    }
    const newItems = [...items]
    const [moved] = newItems.splice(dragItem.current, 1)
    newItems.splice(overIdx, 0, moved)
    onReorder(newItems)
    setDragIdx(null); setOverIdx(null); dragItem.current = null
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-2 border-b border-gray-100" style={{ background: campo.colore + '15' }}>
        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: campo.colore }}/>
        <span className="font-semibold text-sm text-gray-800 flex-1">{campo.nome}</span>
        <span className="text-xs text-gray-400">Inizio: {slotOrario}</span>
        <span className="text-xs text-gray-400 ml-2">{items.length} slot</span>
      </div>

      <div className="divide-y divide-gray-50 min-h-[48px]">
        {items.length === 0 && (
          <div className="px-4 py-5 text-center text-sm text-gray-400">Nessuna partita assegnata</div>
        )}
        {items.map((item, i) => {
          const orario = item.kind === 'partita' ? orariMap.get(item.data.id) : null
          return (
            <div key={item.data.id} draggable
              onDragStart={() => handleDragStart(i)}
              onDragEnter={() => handleDragEnter(i)}
              onDragEnd={handleDragEnd}
              onDragOver={e => e.preventDefault()}
              className={`transition-all ${dragIdx===i ? 'opacity-40' : ''} ${overIdx===i && dragIdx!==i ? 'border-t-2 border-blue-400' : ''}`}
              style={{ cursor: 'grab' }}>
              {item.kind === 'partita'
                ? <PartitaSlot p={item.data} orario={orario ?? undefined}/>
                : <PausaSlot p={item.data} onDelete={() => onDeletePausa(item.data.id)} onUpdate={u => onUpdatePausa(item.data.id, u)}/>
              }
            </div>
          )
        })}
      </div>

      <div className="px-4 py-2 border-t border-gray-100 flex gap-2">
        <button onClick={() => onAddPausa('blocco')}
          className="text-xs px-3 py-1.5 border border-amber-200 text-amber-700 rounded-lg hover:bg-amber-50 transition">
          + Blocco pausa
        </button>
        <button onClick={() => onAddPausa('separatore')}
          className="text-xs px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition">
          + Separatore
        </button>
      </div>
    </div>
  )
}

function PartitaSlot({ p, orario }: { p: Partita; orario?: Date }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 select-none">
      <span className="text-gray-300 text-sm cursor-grab flex-shrink-0">⠿</span>
      {orario && (
        <span className="text-xs font-mono text-blue-600 w-10 flex-shrink-0">{formatOra(orario)}</span>
      )}
      <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0">
        <span className="text-sm font-medium truncate">{(p.squadra_casa as any)?.nome ?? '–'}</span>
        <LogoSquadra squadra={(p.squadra_casa as any) ?? { nome:'?', logo_url:null }} size={18}/>
      </div>
      <span className={`px-2 py-0.5 rounded text-xs font-bold min-w-[36px] text-center flex-shrink-0 ${p.giocata ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
        {p.giocata ? `${p.gol_casa}–${p.gol_ospite}` : 'vs'}
      </span>
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <LogoSquadra squadra={(p.squadra_ospite as any) ?? { nome:'?', logo_url:null }} size={18}/>
        <span className="text-sm font-medium truncate">{(p.squadra_ospite as any)?.nome ?? '–'}</span>
      </div>
    </div>
  )
}

function PausaSlot({ p, onDelete, onUpdate }: { p: Pausa; onDelete: () => void; onUpdate: (u: Partial<Pausa>) => void }) {
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(p.etichetta)
  const [durata, setDurata] = useState(p.durata_minuti)

  if (p.tipo === 'separatore') return (
    <div className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 select-none group">
      <span className="text-gray-300 text-sm cursor-grab">⠿</span>
      <div className="flex-1 flex items-center gap-2">
        <div className="flex-1 border-t border-dashed border-gray-300"/>
        <span className="text-xs text-gray-400">{p.etichetta}</span>
        <div className="flex-1 border-t border-dashed border-gray-300"/>
      </div>
      <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 text-red-400 text-xs">✕</button>
    </div>
  )

  return (
    <div className="px-3 py-2 hover:bg-amber-50 select-none group" style={{ background: p.colore+'15' }}>
      <div className="flex items-center gap-2">
        <span className="text-gray-300 text-sm cursor-grab">⠿</span>
        <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: p.colore }}/>
        {editing ? (
          <>
            <input value={label} onChange={e => setLabel(e.target.value)} className="flex-1 text-xs px-2 py-1 border border-gray-300 rounded"/>
            <input type="number" value={durata} onChange={e => setDurata(+e.target.value)} min={5} max={120} className="w-14 text-xs px-2 py-1 border border-gray-300 rounded text-center"/>
            <span className="text-xs text-gray-400">min</span>
            <button onClick={() => { onUpdate({ etichetta: label, durata_minuti: durata }); setEditing(false) }} className="text-green-600 text-xs font-medium">✓</button>
          </>
        ) : (
          <>
            <span className="flex-1 text-xs font-medium text-amber-800">{p.etichetta}</span>
            <span className="text-xs text-amber-600">{p.durata_minuti} min</span>
            <button onClick={() => setEditing(true)} className="opacity-0 group-hover:opacity-100 text-xs text-gray-400">✏️</button>
          </>
        )}
        <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 text-red-400 text-xs">✕</button>
      </div>
    </div>
  )
}
