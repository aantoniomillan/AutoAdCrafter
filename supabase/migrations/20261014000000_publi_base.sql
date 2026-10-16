CREATE TYPE public.video_status AS ENUM ('pendiente','publicado','error');

CREATE TABLE public.videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL DEFAULT auth.uid(),
  path text NOT NULL,
  "publicUrl" text NOT NULL,
  caption text NOT NULL DEFAULT '',
  "subtitleText" text NOT NULL DEFAULT '',
  status public.video_status NOT NULL DEFAULT 'pendiente',
  "scheduledAt" timestamptz NOT NULL,
  "publishedAt" timestamptz,
  error text,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.videos TO authenticated;
GRANT ALL ON public.videos TO service_role;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own videos" ON public.videos FOR ALL TO authenticated USING (auth.uid() = "userId") WITH CHECK (auth.uid() = "userId");
CREATE INDEX videos_user_sched ON public.videos ("userId", "scheduledAt");

CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL DEFAULT auth.uid(),
  platform text NOT NULL,
  "externalId" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own accounts" ON public.accounts FOR ALL TO authenticated USING (auth.uid() = "userId") WITH CHECK (auth.uid() = "userId");

CREATE TABLE public.settings (
  "userId" uuid PRIMARY KEY DEFAULT auth.uid(),
  "intervalHours" integer NOT NULL DEFAULT 24
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own settings" ON public.settings FOR ALL TO authenticated USING (auth.uid() = "userId") WITH CHECK (auth.uid() = "userId");

CREATE POLICY "videos read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'videos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "videos insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'videos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "videos update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'videos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "videos delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'videos' AND (storage.foldername(name))[1] = auth.uid()::text);