-- v10: token live, giornate eliminatoria
ALTER TABLE public.tornei ADD COLUMN IF NOT EXISTS token_live text UNIQUE;
CREATE TABLE IF NOT EXISTS public.girone_giornate (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  girone_id uuid REFERENCES public.gironi(id) ON DELETE CASCADE NOT NULL,
  giornata_id uuid REFERENCES public.giornate(id) ON DELETE CASCADE NOT NULL,
  UNIQUE(girone_id, giornata_id)
);
ALTER TABLE public.girone_giornate ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "GironeGiornate visibili a tutti" ON public.girone_giornate FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "GironeGiornate gestibili dall'admin" ON public.girone_giornate FOR ALL USING (
  EXISTS (SELECT 1 FROM public.gironi g JOIN public.tornei t ON t.id = g.torneo_id WHERE g.id = girone_id AND t.admin_id = auth.uid())
);
