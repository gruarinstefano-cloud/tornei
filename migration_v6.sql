-- =========================================
-- MIGRAZIONE v6 — Orari, tempo tecnico, durata fasi
-- Esegui in Supabase > SQL Editor
-- =========================================

-- Aggiunge data inizio e orario di inizio per campo
alter table public.tornei add column if not exists data_inizio date;
alter table public.tornei add column if not exists durata_partita_eliminazione_minuti int default 20;
alter table public.tornei add column if not exists tempo_tecnico_minuti int default 5;

-- Orario di inizio per ogni campo (indipendente)
alter table public.campi add column if not exists orario_inizio time default '09:00';
alter table public.campi add column if not exists data_inizio date;

-- Aggiunge colonna orario calcolato alle partite
alter table public.partite add column if not exists orario_calcolato timestamptz;
