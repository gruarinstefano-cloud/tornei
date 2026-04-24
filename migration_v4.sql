-- =========================================
-- MIGRAZIONE v4 — Link privato per risultati
-- Esegui in Supabase > SQL Editor
-- =========================================

-- Aggiunge token al torneo (link privato revocabile)
alter table public.tornei add column if not exists token_live text unique;

-- Permette aggiornare partite tramite token (senza auth)
-- Usiamo una funzione RPC sicura che verifica il token
create or replace function public.aggiorna_risultato_con_token(
  p_token text,
  p_partita_id uuid,
  p_gol_casa int,
  p_gol_ospite int
)
returns json
language plpgsql
security definer
as $$
declare
  v_torneo_id uuid;
  v_partita_torneo_id uuid;
begin
  -- Trova il torneo associato al token
  select id into v_torneo_id
  from public.tornei
  where token_live = p_token;

  if v_torneo_id is null then
    return json_build_object('ok', false, 'error', 'Token non valido');
  end if;

  -- Verifica che la partita appartenga a questo torneo
  select torneo_id into v_partita_torneo_id
  from public.partite
  where id = p_partita_id;

  if v_partita_torneo_id != v_torneo_id then
    return json_build_object('ok', false, 'error', 'Partita non trovata');
  end if;

  -- Aggiorna il risultato
  update public.partite
  set gol_casa = p_gol_casa, gol_ospite = p_gol_ospite, giocata = true
  where id = p_partita_id;

  return json_build_object('ok', true);
end;
$$;

-- Funzione RPC per generare fase eliminatoria tramite token
create or replace function public.genera_eliminatoria_con_token(
  p_token text,
  p_partite jsonb
)
returns json
language plpgsql
security definer
as $$
declare
  v_torneo_id uuid;
begin
  select id into v_torneo_id
  from public.tornei
  where token_live = p_token;

  if v_torneo_id is null then
    return json_build_object('ok', false, 'error', 'Token non valido');
  end if;

  -- Elimina fase eliminatoria esistente
  delete from public.partite
  where torneo_id = v_torneo_id
  and fase in ('quarti','semifinale','finale','terzo_posto');

  -- Inserisce le nuove partite
  insert into public.partite (torneo_id, squadra_casa_id, squadra_ospite_id, fase, girone, giocata)
  select
    v_torneo_id,
    (p->>'squadra_casa_id')::uuid,
    (p->>'squadra_ospite_id')::uuid,
    (p->>'fase')::text,
    null,
    false
  from jsonb_array_elements(p_partite) as p;

  return json_build_object('ok', true);
end;
$$;
