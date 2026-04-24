-- =========================================
-- SCHEMA TORNEI CALCIO
-- Esegui questo script in Supabase > SQL Editor
-- =========================================

-- Profili admin (collegati a auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  nome text not null,
  email text not null,
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "Profilo visibile all'owner" on public.profiles
  for select using (auth.uid() = id);
create policy "Profilo modificabile dall'owner" on public.profiles
  for update using (auth.uid() = id);

-- Trigger: crea profilo automaticamente al signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, nome, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', new.email), new.email);
  return new;
end;
$$ language plpgsql security definer;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Tornei
create table public.tornei (
  id uuid default gen_random_uuid() primary key,
  admin_id uuid references public.profiles(id) on delete cascade not null,
  nome text not null,
  slug text not null unique,
  tipo text not null check (tipo in ('gironi_eliminazione','campionato_eliminazione')),
  stato text not null default 'bozza' check (stato in ('bozza','attivo','concluso')),
  colore_primario text default '#1e40af',
  colore_secondario text default '#1e3a5f',
  nome_societa text default '',
  sponsor text[] default '{}',
  created_at timestamptz default now()
);
alter table public.tornei enable row level security;
create policy "Tornei visibili a tutti" on public.tornei
  for select using (true);
create policy "Tornei gestibili dall'admin owner" on public.tornei
  for all using (auth.uid() = admin_id);

-- Squadre
create table public.squadre (
  id uuid default gen_random_uuid() primary key,
  torneo_id uuid references public.tornei(id) on delete cascade not null,
  nome text not null,
  girone text,
  created_at timestamptz default now()
);
alter table public.squadre enable row level security;
create policy "Squadre visibili a tutti" on public.squadre
  for select using (true);
create policy "Squadre gestibili dall'admin del torneo" on public.squadre
  for all using (
    exists (select 1 from public.tornei t where t.id = torneo_id and t.admin_id = auth.uid())
  );

-- Campi
create table public.campi (
  id uuid default gen_random_uuid() primary key,
  torneo_id uuid references public.tornei(id) on delete cascade not null,
  nome text not null,
  colore text default '#3b82f6',
  ordine int default 0
);
alter table public.campi enable row level security;
create policy "Campi visibili a tutti" on public.campi
  for select using (true);
create policy "Campi gestibili dall'admin del torneo" on public.campi
  for all using (
    exists (select 1 from public.tornei t where t.id = torneo_id and t.admin_id = auth.uid())
  );

-- Partite
create table public.partite (
  id uuid default gen_random_uuid() primary key,
  torneo_id uuid references public.tornei(id) on delete cascade not null,
  squadra_casa_id uuid references public.squadre(id) on delete cascade not null,
  squadra_ospite_id uuid references public.squadre(id) on delete cascade not null,
  campo_id uuid references public.campi(id) on delete set null,
  fase text not null check (fase in ('girone','campionato','quarti','semifinale','finale','terzo_posto')),
  girone text,
  data_ora timestamptz,
  gol_casa int,
  gol_ospite int,
  giocata boolean default false,
  created_at timestamptz default now()
);
alter table public.partite enable row level security;
create policy "Partite visibili a tutti" on public.partite
  for select using (true);
create policy "Partite gestibili dall'admin del torneo" on public.partite
  for all using (
    exists (select 1 from public.tornei t where t.id = torneo_id and t.admin_id = auth.uid())
  );

-- Indici per performance
create index on public.tornei(slug);
create index on public.squadre(torneo_id);
create index on public.partite(torneo_id);
create index on public.partite(squadra_casa_id);
create index on public.partite(squadra_ospite_id);
