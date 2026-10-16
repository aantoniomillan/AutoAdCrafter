ALTER TABLE public.videos
  ADD COLUMN "processed" boolean NOT NULL DEFAULT false,
  ADD COLUMN "srcPath" text,
  ADD COLUMN "lockedAt" timestamptz;
CREATE OR REPLACE FUNCTION public."vidGuard"() RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user = 'authenticated' AND OLD."lockedAt" IS NOT NULL THEN
    RAISE EXCEPTION 'Video en publicacion';
  END IF;
  IF NEW."subtitleText" IS DISTINCT FROM OLD."subtitleText" THEN
    NEW.processed := false;
  END IF;
  IF current_user = 'authenticated' AND NEW.status IS DISTINCT FROM OLD.status
     AND NOT (OLD.status = 'error' AND NEW.status = 'pendiente') THEN
    RAISE EXCEPTION 'Cambio de estado no permitido';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "vidGuard" ON public.videos;
CREATE TRIGGER "vidGuard" BEFORE UPDATE ON public.videos FOR EACH ROW EXECUTE FUNCTION public."vidGuard"();
CREATE OR REPLACE FUNCTION public."vidDelGuard"() RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user = 'authenticated' AND OLD."lockedAt" IS NOT NULL THEN
    RAISE EXCEPTION 'Video en publicacion';
  END IF;
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS "vidDelGuard" ON public.videos;
CREATE TRIGGER "vidDelGuard" BEFORE DELETE ON public.videos FOR EACH ROW EXECUTE FUNCTION public."vidDelGuard"();
ALTER TABLE public.accounts
  ADD COLUMN "status" text NOT NULL DEFAULT 'pendiente' CHECK ("status" IN ('pendiente','conectada','error')),
  ADD COLUMN "lastError" text,
  ADD COLUMN "checkedAt" timestamptz;
CREATE OR REPLACE FUNCTION public."accGuard"() RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW."externalId" IS DISTINCT FROM OLD."externalId" THEN
    NEW."status" := 'pendiente';
    NEW."lastError" := null;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "accGuard" ON public.accounts;
CREATE TRIGGER "accGuard" BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public."accGuard"();
REVOKE INSERT, UPDATE ON public.accounts FROM authenticated, anon;
GRANT INSERT ("userId", platform, "externalId") ON public.accounts TO authenticated;
GRANT UPDATE (platform, "externalId") ON public.accounts TO authenticated;
REVOKE INSERT, UPDATE ON public.videos FROM authenticated, anon;
GRANT INSERT ("userId", path, "publicUrl", caption, "subtitleText", "scheduledAt") ON public.videos TO authenticated;
GRANT UPDATE ("scheduledAt", caption, "subtitleText", status, error) ON public.videos TO authenticated;
GRANT ALL ON public.videos TO service_role;
GRANT ALL ON public.accounts TO service_role;
CREATE EXTENSION IF NOT EXISTS supabase_vault;
CREATE OR REPLACE FUNCTION public."setIgToken"("accId" uuid, token text) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  sid uuid;
  nm text := 'ig_' || "accId"::text;
BEGIN
  IF token IS NULL OR length(btrim(token)) = 0 THEN
    RAISE EXCEPTION 'Token vacio';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = "accId") THEN
    RAISE EXCEPTION 'Cuenta no encontrada';
  END IF;
  SELECT s.id INTO sid FROM vault.secrets s WHERE s.name = nm;
  IF sid IS NULL THEN
    PERFORM vault.create_secret(token, nm);
  ELSE
    PERFORM vault.update_secret(sid, token);
  END IF;
END;
$$;
CREATE OR REPLACE FUNCTION public."getIgToken"("accId" uuid) RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.decrypted_secret FROM vault.decrypted_secrets s WHERE s.name = 'ig_' || "accId"::text LIMIT 1;
$$;
CREATE OR REPLACE FUNCTION public."igTokenSet"("accId" uuid) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = "accId" AND a."userId" = auth.uid())
     AND EXISTS (SELECT 1 FROM vault.secrets s WHERE s.name = 'ig_' || "accId"::text);
$$;
REVOKE EXECUTE ON FUNCTION public."setIgToken"(uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public."setIgToken"(uuid, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public."getIgToken"(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public."getIgToken"(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public."igTokenSet"(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public."igTokenSet"(uuid) TO authenticated, service_role;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE OR REPLACE FUNCTION public."callPublicar"() RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  dst text;
  sec text;
BEGIN
  SELECT s.decrypted_secret INTO dst FROM vault.decrypted_secrets s WHERE s.name = 'publicarUrl' LIMIT 1;
  SELECT s.decrypted_secret INTO sec FROM vault.decrypted_secrets s WHERE s.name = 'publicarSecret' LIMIT 1;
  IF dst IS NULL OR sec IS NULL THEN
    RAISE NOTICE 'Faltan los secretos publicarUrl o publicarSecret';
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := dst,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', sec),
    timeout_milliseconds := 300000
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public."callPublicar"() FROM public, anon, authenticated;
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'publicar';
SELECT cron.schedule('publicar', '*/10 * * * *', 'select public."callPublicar"()');
