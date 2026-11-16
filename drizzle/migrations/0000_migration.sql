DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['media','episodes','hero_slides','categories','genres'] LOOP
    EXECUTE format('CREATE TABLE public.%I (id text PRIMARY KEY, data jsonb NOT NULL DEFAULT ''{}''::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())', t);
    EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "Anyone can read %s" ON public.%I FOR SELECT TO anon, authenticated USING (true)', t, t);
  END LOOP;
END $$;

CREATE TABLE public.media_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id text NOT NULL,
  viewer_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.media_views TO service_role;
ALTER TABLE public.media_views ENABLE ROW LEVEL SECURITY;
CREATE INDEX media_views_created_idx ON public.media_views (created_at);

CREATE OR REPLACE FUNCTION public.view_stats(_days int)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'daily', COALESCE((SELECT jsonb_agg(jsonb_build_object('day', d::date, 'views', c) ORDER BY d)
      FROM (SELECT g d, (SELECT count(*) FROM media_views v WHERE v.created_at::date = g::date) c
            FROM generate_series(current_date - (_days-1), current_date, interval '1 day') g) x), '[]'::jsonb),
    'today', (SELECT count(*) FROM media_views WHERE created_at >= current_date),
    'week', (SELECT count(*) FROM media_views WHERE created_at >= now() - interval '7 days'),
    'month', (SELECT count(*) FROM media_views WHERE created_at >= now() - interval '30 days'),
    'top', COALESCE((SELECT jsonb_agg(jsonb_build_object('media_id', media_id, 'views', c))
      FROM (SELECT media_id, count(*) c FROM media_views WHERE created_at >= now() - make_interval(days => _days)
            GROUP BY media_id ORDER BY c DESC LIMIT 10) t), '[]'::jsonb)
  )
$$;
REVOKE ALL ON FUNCTION public.view_stats(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.view_stats(int) TO service_role;