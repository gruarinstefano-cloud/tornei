-- =========================================
-- MIGRAZIONE v2 — Loghi squadre + storage
-- Esegui in Supabase > SQL Editor
-- =========================================

-- Aggiunge colonna logo_url alla tabella squadre
alter table public.squadre add column if not exists logo_url text;

-- Aggiunge colonne per configurazione eliminatoria al torneo
alter table public.tornei add column if not exists n_squadre_eliminatoria int default 4;

-- Crea bucket per i loghi delle squadre
insert into storage.buckets (id, name, public)
values ('loghi', 'loghi', true)
on conflict (id) do nothing;

-- Policy: chiunque può vedere i loghi
create policy "Loghi pubblici"
  on storage.objects for select
  using (bucket_id = 'loghi');

-- Policy: admin autenticati possono caricare loghi
create policy "Admin può caricare loghi"
  on storage.objects for insert
  with check (bucket_id = 'loghi' and auth.role() = 'authenticated');

-- Policy: admin autenticati possono aggiornare loghi
create policy "Admin può aggiornare loghi"
  on storage.objects for update
  using (bucket_id = 'loghi' and auth.role() = 'authenticated');

-- Policy: admin autenticati possono eliminare loghi
create policy "Admin può eliminare loghi"
  on storage.objects for delete
  using (bucket_id = 'loghi' and auth.role() = 'authenticated');
