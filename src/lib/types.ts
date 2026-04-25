export type Torneo = {
  id: string
  admin_id: string
  nome: string
  slug: string
  tipo: 'gironi_eliminazione' | 'campionato_eliminazione'
  stato: 'bozza' | 'attivo' | 'concluso'
  colore_primario: string
  colore_secondario: string
  nome_societa: string
  sponsor: string[]
  banner_url: string | null
  n_squadre_eliminatoria: number
  finale_terzo_posto: boolean
  durata_partita_minuti: number
  durata_partita_eliminazione_minuti: number
  tempo_tecnico_minuti: number
  data_inizio: string | null
  orario_inizio_default: string
  token_live: string | null
  created_at: string
}

export type Giornata = {
  id: string
  torneo_id: string
  data: string        // ISO date YYYY-MM-DD
  ordine: number
  slot?: SlotCampo[]  // orari per campo in questa giornata
}

export type SlotCampo = {
  id: string
  torneo_id: string
  giornata_id: string
  campo_id: string
  orario_inizio: string  // HH:MM
  campo?: Campo
}

export type GironeCampo = {
  id: string
  girone_id: string
  campo_id: string
  ordine: number
  campo?: Campo
}

export type Girone = {
  id: string
  torneo_id: string
  nome: string
  campo_id: string | null   // legacy, primo campo
  ordine: number
  campo?: Campo
  girone_campi?: GironeCampo[]  // tutti i campi del girone
}

export type Sponsor = {
  id: string
  torneo_id: string
  nome: string
  logo_url: string | null
  sito_web: string | null
  ordine: number
}

export type Squadra = {
  id: string
  torneo_id: string
  nome: string
  girone: string | null
  girone_id: string | null
  logo_url: string | null
}

export type Campo = {
  id: string
  torneo_id: string
  nome: string
  colore: string
  ordine: number
  orario_inizio: string
  data_inizio: string | null
}

export type Partita = {
  id: string
  torneo_id: string
  squadra_casa_id: string
  squadra_ospite_id: string
  campo_id: string | null
  girone_id: string | null
  giornata_id: string | null
  fase: 'girone' | 'campionato' | 'quarti' | 'semifinale' | 'finale' | 'terzo_posto'
  girone: string | null
  data_ora: string | null
  orario_calcolato: string | null
  gol_casa: number | null
  gol_ospite: number | null
  giocata: boolean
  ordine_calendario: number
  squadra_casa?: Squadra
  squadra_ospite?: Squadra
  campo?: Campo
}

export type Pausa = {
  id: string
  torneo_id: string
  campo_id: string
  giornata_id: string | null
  etichetta: string
  durata_minuti: number
  tipo: 'blocco' | 'separatore'
  colore: string
  ordine_calendario: number
}

export type CalendarioItem =
  | { kind: 'partita'; data: Partita }
  | { kind: 'pausa'; data: Pausa }

export type StatSquadra = {
  squadra: Squadra
  g: number; v: number; p: number; s: number; gf: number; gs: number; pt: number
}

export function calcolaClassifica(squadre: Squadra[], partite: Partita[], gironeId?: string): StatSquadra[] {
  const filtered = gironeId ? squadre.filter(s => s.girone_id === gironeId) : squadre
  return filtered.map(sq => {
    const mine = partite.filter(p =>
      p.giocata &&
      (p.squadra_casa_id === sq.id || p.squadra_ospite_id === sq.id) &&
      (!gironeId || p.girone_id === gironeId)
    )
    let v=0, par=0, s=0, gf=0, gs=0
    mine.forEach(p => {
      const casa = p.squadra_casa_id === sq.id
      const miei = casa ? (p.gol_casa??0) : (p.gol_ospite??0)
      const avv  = casa ? (p.gol_ospite??0) : (p.gol_casa??0)
      gf += miei; gs += avv
      if (miei > avv) v++; else if (miei === avv) par++; else s++
    })
    return { squadra: sq, g: mine.length, v, p: par, s, gf, gs, pt: v*3+par }
  }).sort((a, b) => b.pt-a.pt || (b.gf-b.gs)-(a.gf-a.gs) || b.gf-a.gf)
}

export function generaRoundRobin(squadre: Squadra[]): [Squadra, Squadra][] {
  const pairs: [Squadra, Squadra][] = []
  for (let i=0; i<squadre.length; i++)
    for (let j=i+1; j<squadre.length; j++)
      pairs.push([squadre[i], squadre[j]])
  return pairs
}

// Distribuisce partite tra più campi in modo alternato (round-robin sui campi)
// Rispetta anche il vincolo interleaved: nessuna squadra gioca 2 volte di fila
export function distribuisciSuCampi(
  pairs: [Squadra, Squadra][],
  campoIds: string[]
): { pair: [Squadra, Squadra]; campo_id: string }[] {
  if (campoIds.length <= 1) {
    return pairs.map(pair => ({ pair, campo_id: campoIds[0] ?? '' }))
  }
  // Assegna in modo alternato per campo, rispettando interleaved
  const result: { pair: [Squadra, Squadra]; campo_id: string }[] = []
  const perCampo: [Squadra, Squadra][][] = campoIds.map(() => [])
  // Distribuisce round-robin sulle coppie ordinate
  pairs.forEach((pair, i) => {
    perCampo[i % campoIds.length].push(pair)
  })
  // Ricostruisce la lista interleaved per campo
  const maxLen = Math.max(...perCampo.map(p => p.length))
  for (let i = 0; i < maxLen; i++) {
    for (let c = 0; c < campoIds.length; c++) {
      if (perCampo[c][i]) {
        result.push({ pair: perCampo[c][i], campo_id: campoIds[c] })
      }
    }
  }
  return result
}

export function generaCalendarioInterleaved(pairs: [Squadra, Squadra][]): [Squadra, Squadra][] {
  const result: [Squadra, Squadra][] = []
  const remaining = [...pairs]
  while (remaining.length > 0) {
    const last = result[result.length-1]
    const lastIds = last ? new Set([last[0].id, last[1].id]) : new Set<string>()
    const idx = remaining.findIndex(([a,b]) => !lastIds.has(a.id) && !lastIds.has(b.id))
    result.push(idx === -1 ? remaining.shift()! : remaining.splice(idx,1)[0])
  }
  return result
}

// Calcola orari per un campo in una giornata specifica
// items: partite+pause ordinate per ordine_calendario
// dataStr: YYYY-MM-DD
// orarioInizio: HH:MM
// durata: minuti partita girone
// durataElim: minuti partita eliminatoria
// tempoTecnico: minuti cambio campo
export function calcolaOrariSlot(
  items: CalendarioItem[],
  dataStr: string,
  orarioInizio: string,
  durata: number,
  durataElim: number,
  tempoTecnico: number
): Map<string, Date> {
  const [hh, mm] = orarioInizio.split(':').map(Number)
  let current = new Date(`${dataStr}T${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:00`)
  const result = new Map<string, Date>()
  for (const item of items) {
    if (item.kind === 'pausa') {
      if (item.data.tipo !== 'separatore')
        current = new Date(current.getTime() + item.data.durata_minuti * 60000)
      continue
    }
    result.set(item.data.id, new Date(current))
    const faseElim = ['quarti','semifinale','finale','terzo_posto'].includes(item.data.fase)
    current = new Date(current.getTime() + ((faseElim ? durataElim : durata) + tempoTecnico) * 60000)
  }
  return result
}

export function formatOra(dt: string | Date | null | undefined): string {
  if (!dt) return ''
  const d = typeof dt === 'string' ? new Date(dt) : dt
  return d.toLocaleTimeString('it-IT', { hour:'2-digit', minute:'2-digit' })
}

export function formatDataBreve(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('it-IT', { weekday:'short', day:'2-digit', month:'short' })
}

export function generaEliminatoria(
  gironi: Girone[],
  classifiche: Record<string, StatSquadra[]>,
  nPerGirone: number,
  finaleTP: boolean
): { casa: Squadra; ospite: Squadra; fase: Partita['fase'] }[] {
  const qualificate: Squadra[] = []
  for (let pos=0; pos<nPerGirone; pos++)
    for (const g of gironi)
      if (classifiche[g.id]?.[pos]) qualificate.push(classifiche[g.id][pos].squadra)
  const n = qualificate.length
  const fase: Partita['fase'] = n>=8 ? 'quarti' : n>=4 ? 'semifinale' : 'finale'
  const pairs: { casa: Squadra; ospite: Squadra; fase: Partita['fase'] }[] = []
  for (let i=0; i<n/2; i++)
    pairs.push({ casa: qualificate[i], ospite: qualificate[n-1-i], fase })
  if (finaleTP && fase==='semifinale' && n>=4)
    pairs.push({ casa: qualificate[1], ospite: qualificate[2], fase: 'terzo_posto' })
  return pairs
}
