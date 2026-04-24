-- =========================================
-- MIGRAZIONE v3 — Banner e sponsor avanzati
-- Esegui in Supabase > SQL Editor
-- =========================================

-- Aggiunge colonna banner_url al torneo (immagine in cima)
alter table public.tornei add column if not exists banner_url text;

-- Sostituisce il vecchio array sponsor (stringhe) con una tabella dedicata
create table if not exists public.sponsor (
  id uuid default gen_random_uuid() primary key,
  torneo_id uuid references public.tornei(id) on delete cascade not null,
  nome text not null,
  logo_url text,
  sito_web text,
  ordine int default 0
);
alter table public.sponsor enable row level security;
create policy "Sponsor visibili a tutti" on public.sponsor
  for select using (true);
create policy "Sponsor gestibili dall'admin del torneo" on public.sponsor
  for all using (
    exists (select 1 from public.tornei t where t.id = torneo_id and t.admin_id = auth.uid())
  );
create index if not exists on public.sponsor(torneo_id);

-- Aggiungi bucket per banner e loghi sponsor (se non esiste già)
insert into storage.buckets (id, name, public)
values ('banner', 'banner', true)
on conflict (id) do nothing;

-- Policy storage banner
create policy "Banner pubblici"
  on storage.objects for select
  using (bucket_id = 'banner');
create policy "Admin può caricare banner"
  on storage.objects for insert
  with check (bucket_id = 'banner' and auth.role() = 'authenticated');
create policy "Admin può aggiornare banner"
  on storage.objects for update
  using (bucket_id = 'banner' and auth.role() = 'authenticated');
create policy "Admin può eliminare banner"
  on storage.objects for delete
  using (bucket_id = 'banner' and auth.role() = 'authenticated');
