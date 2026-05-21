
CREATE TABLE IF NOT EXISTS public.user_shopping_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  purchases jsonb NOT NULL DEFAULT '[]'::jsonb,
  orders jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_shopping_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_shopping_metadata_owner_all"
  ON public.user_shopping_metadata
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_user_shopping_metadata_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_shopping_metadata_updated_at ON public.user_shopping_metadata;
CREATE TRIGGER trg_user_shopping_metadata_updated_at
  BEFORE UPDATE ON public.user_shopping_metadata
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_user_shopping_metadata_updated_at();
