INSERT INTO storage.buckets (id, name, public, allowed_mime_types)
VALUES ('videos', 'videos', true, ARRAY['video/mp4'])
ON CONFLICT (id) DO UPDATE SET public = true, allowed_mime_types = EXCLUDED.allowed_mime_types;
