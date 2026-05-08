-- v8: gironi configurabili con più campi
CREATE TABLE IF NOT EXISTS public.gironi (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  torneo_id uuid REFERENCES public.tornei(id) ON DELETE CASCADE NOT NULL,
  nome text NOT NULL,
  campo_id uuid REFERENCES public.campi(id) ON DELETE SET NULL,
  giornata_id uuid REFERENCES public.giornate(id) ON DELETE SET NULL,
  ordine int DEFAULT 0
);
ALTER TABLE public.gironi ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Gironi visibili a tutti" ON public.gironi FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Gironi gestibili dall'admin" ON public.gironi FOR ALL USING (
  EXISTS (SELECT 1 FROM public.tornei t WHERE t.id = torneo_id AND t.admin_id = auth.uid())
);
ALTER TABLE public.squadre ADD COLUMN IF NOT EXISTS girone_id uuid REFERENCES public.gironi(id) ON DELETE SET NULL;
ALTER TABLE public.partite ADD COLUMN IF NOT EXISTS girone_id uuid REFERENCES public.gironi(id) ON DELETE SET NULL;
CREATE TABLE IF NOT EXISTS public.girone_campi (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  girone_id uuid REFERENCES public.gironi(id) ON DELETE CASCADE NOT NULL,
  campo_id uuid REFERENCES public.campi(id) ON DELETE CASCADE NOT NULL,
  ordine int DEFAULT 0,
  UNIQUE(girone_id, campo_id)
);
ALTER TABLE public.girone_campi ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "GironeCampi visibili a tutti" ON public.girone_campi FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "GironeCampi gestibili dall'admin" ON public.girone_campi FOR ALL USING (
  EXISTS (SELECT 1 FROM public.gironi g JOIN public.tornei t ON t.id = g.torneo_id WHERE g.id = girone_id AND t.admin_id = auth.uid())
);
ALTER TABLE public.tornei ADD COLUMN IF NOT EXISTS n_squadre_eliminatoria int DEFAULT 4;
