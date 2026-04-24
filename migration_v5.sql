-- =========================================
-- MIGRAZIONE v5 — Gironi configurabili, pause, finale 3/4, calendario
-- Esegui in Supabase > SQL Editor
-- =========================================

-- Tabella gironi (sostituisce il campo girone come testo libero)
create table if not exists public.gironi (
  id uuid default gen_random_uuid() primary key,
  torneo_id uuid references public.tornei(id) on delete cascade not null,
  nome text not null,         -- es. "A", "B", "C"
  campo_id uuid references public.campi(id) on delete set null,
  ordine int default 0
);
alter table public.gironi enable row level security;
create policy "Gironi visibili a tutti" on public.gironi
  for select using (true);
create policy "Gironi gestibili dall'admin" on public.gironi
  for all using (
    exists (select 1 from public.tornei t where t.id = torneo_id and t.admin_id = auth.uid())
  );
create index if not exists idx_gironi_torneo on public.gironi(torneo_id);

-- Aggiunge girone_id alle squadre (oltre al campo testo girone esistente)
alter table public.squadre add column if not exists girone_id uuid references public.gironi(id) on delete set null;

-- Aggiunge girone_id alle partite
alter table public.partite add column if not exists girone_id uuid references public.gironi(id) on delete set null;

-- Aggiunge colonna ordine alle partite per drag & drop
alter table public.partite add column if not exists ordine_calendario int default 0;

-- Tabella pause nel calendario
create table if not exists public.pause (
  id uuid default gen_random_uuid() primary key,
  torneo_id uuid references public.tornei(id) on delete cascade not null,
  campo_id uuid references public.campi(id) on delete cascade not null,
  etichetta text not null default 'Pausa',
  durata_minuti int default 15,
  tipo text not null default 'blocco' check (tipo in ('blocco', 'separatore')),
  colore text default '#f59e0b',
  ordine_calendario int default 0
);
alter table public.pause enable row level security;
create policy "Pause visibili a tutti" on public.pause
  for select using (true);
create policy "Pause gestibili dall'admin" on public.pause
  for all using (
    exists (select 1 from public.tornei t where t.id = torneo_id and t.admin_id = auth.uid())
  );
create index if not exists idx_pause_torneo on public.pause(torneo_id);
create index if not exists idx_pause_campo on public.pause(campo_id);

-- Aggiunge opzioni torneo: finale 3/4 posto, durata partita
alter table public.tornei add column if not exists finale_terzo_posto boolean default false;
alter table public.tornei add column if not exists durata_partita_minuti int default 20;
alter table public.tornei add column if not exists orario_inizio_default time default '09:00';
