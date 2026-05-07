-- =========================================
-- MIGRAZIONE v10 — Gironi per giornata, fase finale configurabile
-- Esegui in Supabase > SQL Editor
-- =========================================

-- Associazione girone <-> giornata (molti a molti)
create table if not exists public.girone_giornate (
  id uuid default gen_random_uuid() primary key,
  girone_id uuid references public.gironi(id) on delete cascade not null,
  giornata_id uuid references public.giornate(id) on delete cascade not null,
  unique(girone_id, giornata_id)
);
alter table public.girone_giornate enable row level security;
create policy "GironeGiornate visibili a tutti" on public.girone_giornate for select using (true);
create policy "GironeGiornate gestibili dall'admin" on public.girone_giornate for all using (
  exists (
    select 1 from public.gironi g
    join public.tornei t on t.id = g.torneo_id
    where g.id = girone_id and t.admin_id = auth.uid()
  )
);
create index if not exists idx_girone_giornate_girone on public.girone_giornate(girone_id);
create index if not exists idx_girone_giornate_giornata on public.girone_giornate(giornata_id);

-- Aggiunge giornata_id ai gironi (giornata principale/default)
alter table public.gironi add column if not exists giornata_id uuid references public.giornate(id) on delete set null;
