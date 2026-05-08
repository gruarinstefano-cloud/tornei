-- v7: giornate multi-giorno
CREATE TABLE IF NOT EXISTS public.giornate (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  torneo_id uuid REFERENCES public.tornei(id) ON DELETE CASCADE NOT NULL,
  data date NOT NULL,
  ordine int DEFAULT 0
);
ALTER TABLE public.giornate ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Giornate visibili a tutti" ON public.giornate FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Giornate gestibili dall'admin" ON public.giornate FOR ALL USING (
  EXISTS (SELECT 1 FROM public.tornei t WHERE t.id = torneo_id AND t.admin_id = auth.uid())
);
CREATE TABLE IF NOT EXISTS public.slot_campo (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  torneo_id uuid REFERENCES public.tornei(id) ON DELETE CASCADE NOT NULL,
  giornata_id uuid REFERENCES public.giornate(id) ON DELETE CASCADE NOT NULL,
  campo_id uuid REFERENCES public.campi(id) ON DELETE CASCADE NOT NULL,
  orario_inizio time NOT NULL DEFAULT '09:00',
  UNIQUE(giornata_id, campo_id)
);
ALTER TABLE public.slot_campo ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "SlotCampo visibili a tutti" ON public.slot_campo FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "SlotCampo gestibili dall'admin" ON public.slot_campo FOR ALL USING (
  EXISTS (SELECT 1 FROM public.tornei t WHERE t.id = torneo_id AND t.admin_id = auth.uid())
);
CREATE TABLE IF NOT EXISTS public.pause (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  torneo_id uuid REFERENCES public.tornei(id) ON DELETE CASCADE NOT NULL,
  campo_id uuid REFERENCES public.campi(id) ON DELETE CASCADE NOT NULL,
  giornata_id uuid REFERENCES public.giornate(id) ON DELETE SET NULL,
  etichetta text NOT NULL DEFAULT 'Pausa',
  durata_minuti int DEFAULT 15,
  tipo text NOT NULL DEFAULT 'blocco' CHECK (tipo IN ('blocco','separatore')),
  colore text DEFAULT '#f59e0b',
  ordine_calendario int DEFAULT 0
);
ALTER TABLE public.pause ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Pause visibili a tutti" ON public.pause FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Pause gestibili dall'admin" ON public.pause FOR ALL USING (
  EXISTS (SELECT 1 FROM public.tornei t WHERE t.id = torneo_id AND t.admin_id = auth.uid())
);
