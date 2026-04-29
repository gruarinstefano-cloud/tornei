-- =========================================
-- MIGRAZIONE v9 — Sezione Info torneo
-- Esegui in Supabase > SQL Editor
-- =========================================

ALTER TABLE public.tornei ADD COLUMN IF NOT EXISTS luogo text;
ALTER TABLE public.tornei ADD COLUMN IF NOT EXISTS info_testo text;
