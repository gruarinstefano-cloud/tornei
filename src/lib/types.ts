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
  orario_inizio_default: string
  token_live: string | null
  created_at: string
}

export type Girone = {
  id: string
  torneo_id: string
  nome: string
  campo_id: string | null
  ordine: number
  campo?: Campo
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
}

export type Partita = {
  id: string
  torneo_id: string
  squadra_casa_id: string
  squadra_ospite_id: string
  campo_id: string | null
  girone_id: string | null
  fase: 'girone' | 'campionato' | 'quarti' | 'semifinale' | 'finale' | 'terzo_posto'
  girone: string | null
  data_ora: string | null
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
  g: number
  v: number
  p: number
  s: number
  gf: number
  gs: number
  pt: number
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
      const gc = p.gol_casa ?? 0
      const go = p.gol_ospite ?? 0
      const miei = casa ? gc : go
      const avv = casa ? go : gc
      gf += miei; gs += avv
      if (miei > avv) v++
      else if (miei === avv) par++
      else s++
    })
    return { squadra: sq, g: mine.length, v, p: par, s, gf, gs, pt: v*3+par }
  }).sort((a, b) => b.pt - a.pt || (b.gf - b.gs) - (a.gf - a.gs) || b.gf - a.gf)
}

// Round-robin rispettando il vincolo: una squadra non gioca 2 partite contemporaneamente
export function generaRoundRobin(squadre: Squadra[]): [Squadra, Squadra][] {
  const pairs: [Squadra, Squadra][] = []
  for (let i = 0; i < squadre.length; i++)
    for (let j = i + 1; j < squadre.length; j++)
      pairs.push([squadre[i], squadre[j]])
  return pairs
}

// Genera calendario interleaved: nessuna squadra gioca 2 partite di fila
export function generaCalendarioInterleaved(pairs: [Squadra, Squadra][]): [Squadra, Squadra][] {
  const result: [Squadra, Squadra][] = []
  const remaining = [...pairs]
  while (remaining.length > 0) {
    const last = result[result.length - 1]
    const lastIds = last ? new Set([last[0].id, last[1].id]) : new Set<string>()
    const idx = remaining.findIndex(([a, b]) => !lastIds.has(a.id) && !lastIds.has(b.id))
    if (idx === -1) {
      result.push(remaining.shift()!)
    } else {
      result.push(remaining.splice(idx, 1)[0])
    }
  }
  return result
}

export function generaEliminatoria(
  gironi: Girone[],
  classifiche: Record<string, StatSquadra[]>,
  nPerGirone: number,
  finaleTermoPostoEnabled: boolean
): { casa: Squadra; ospite: Squadra; fase: Partita['fase'] }[] {
  const qualificate: Squadra[] = []
  for (let pos = 0; pos < nPerGirone; pos++)
    for (const g of gironi)
      if (classifiche[g.id]?.[pos]) qualificate.push(classifiche[g.id][pos].squadra)

  const n = qualificate.length
  const fase: Partita['fase'] = n >= 8 ? 'quarti' : n >= 4 ? 'semifinale' : 'finale'
  const pairs: { casa: Squadra; ospite: Squadra; fase: Partita['fase'] }[] = []
  for (let i = 0; i < n / 2; i++)
    pairs.push({ casa: qualificate[i], ospite: qualificate[n - 1 - i], fase })

  // Aggiunge finale 3°/4° posto se abilitata e ci sono semifinali
  if (finaleTermoPostoEnabled && fase === 'semifinale') {
    pairs.push({ casa: qualificate[1], ospite: qualificate[2], fase: 'terzo_posto' })
  }
  return pairs
}
