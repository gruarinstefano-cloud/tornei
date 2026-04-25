-- =========================================
-- MIGRAZIONE v8 — Più campi per girone
-- Esegui in Supabase > SQL Editor
-- =========================================

-- Tabella di associazione girone <-> campi (molti a molti)
create table if not exists public.girone_campi (
  id uuid default gen_random_uuid() primary key,
  girone_id uuid references public.gironi(id) on delete cascade not null,
  campo_id uuid references public.campi(id) on delete cascade not null,
  ordine int default 0,
  unique(girone_id, campo_id)
);
alter table public.girone_campi enable row level security;
create policy "GironeCampi visibili a tutti" on public.girone_campi
  for select using (true);
create policy "GironeCampi gestibili dall'admin" on public.girone_campi
  for all using (
    exists (
      select 1 from public.gironi g
      join public.tornei t on t.id = g.torneo_id
      where g.id = girone_id and t.admin_id = auth.uid()
    )
  );
create index if not exists idx_girone_campi_girone on public.girone_campi(girone_id);

-- Migra i dati esistenti: se un girone aveva campo_id, crea il record in girone_campi
insert into public.girone_campi (girone_id, campo_id, ordine)
select id, campo_id, 0
from public.gironi
where campo_id is not null
on conflict (girone_id, campo_id) do nothing;
