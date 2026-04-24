-- =========================================
-- MIGRAZIONE v7 — Torneo multi-giorno
-- Esegui in Supabase > SQL Editor
-- =========================================

-- Tabella giornate: ogni riga è un giorno del torneo
create table if not exists public.giornate (
  id uuid default gen_random_uuid() primary key,
  torneo_id uuid references public.tornei(id) on delete cascade not null,
  data date not null,
  ordine int default 0
);
alter table public.giornate enable row level security;
create policy "Giornate visibili a tutti" on public.giornate for select using (true);
create policy "Giornate gestibili dall'admin" on public.giornate for all using (
  exists (select 1 from public.tornei t where t.id = torneo_id and t.admin_id = auth.uid())
);
create index if not exists idx_giornate_torneo on public.giornate(torneo_id);

-- Tabella slot_campo: orario di inizio per ogni campo in ogni giornata
create table if not exists public.slot_campo (
  id uuid default gen_random_uuid() primary key,
  torneo_id uuid references public.tornei(id) on delete cascade not null,
  giornata_id uuid references public.giornate(id) on delete cascade not null,
  campo_id uuid references public.campi(id) on delete cascade not null,
  orario_inizio time not null default '09:00',
  unique(giornata_id, campo_id)
);
alter table public.slot_campo enable row level security;
create policy "SlotCampo visibili a tutti" on public.slot_campo for select using (true);
create policy "SlotCampo gestibili dall'admin" on public.slot_campo for all using (
  exists (select 1 from public.tornei t where t.id = torneo_id and t.admin_id = auth.uid())
);
create index if not exists idx_slot_campo_giornata on public.slot_campo(giornata_id);

-- Aggiunge giornata_id a partite e pause
alter table public.partite add column if not exists giornata_id uuid references public.giornate(id) on delete set null;
alter table public.pause add column if not exists giornata_id uuid references public.giornate(id) on delete cascade;
