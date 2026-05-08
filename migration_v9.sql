-- v9: sponsor avanzati, banner, loghi
ALTER TABLE public.tornei ADD COLUMN IF NOT EXISTS banner_url text;
ALTER TABLE public.tornei ADD COLUMN IF NOT EXISTS nome_societa text DEFAULT '';
CREATE TABLE IF NOT EXISTS public.sponsor (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  torneo_id uuid REFERENCES public.tornei(id) ON DELETE CASCADE NOT NULL,
  nome text NOT NULL,
  logo_url text,
  sito_web text,
  ordine int DEFAULT 0
);
ALTER TABLE public.sponsor ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Sponsor visibili a tutti" ON public.sponsor FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Sponsor gestibili dall'admin" ON public.sponsor FOR ALL USING (
  EXISTS (SELECT 1 FROM public.tornei t WHERE t.id = torneo_id AND t.admin_id = auth.uid())
);
INSERT INTO storage.buckets (id, name, public) VALUES ('loghi','loghi',true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('banner','banner',true) ON CONFLICT (id) DO NOTHING;
