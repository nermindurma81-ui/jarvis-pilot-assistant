-- Storage bucket for uploads (public, 50MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('jarvis-uploads', 'jarvis-uploads', true, 52428800)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 52428800;

CREATE POLICY "Public read jarvis-uploads"
ON storage.objects FOR SELECT
USING (bucket_id = 'jarvis-uploads');

CREATE POLICY "Anyone can upload to jarvis-uploads"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'jarvis-uploads');

CREATE POLICY "Anyone can update jarvis-uploads"
ON storage.objects FOR UPDATE
USING (bucket_id = 'jarvis-uploads');

CREATE POLICY "Anyone can delete jarvis-uploads"
ON storage.objects FOR DELETE
USING (bucket_id = 'jarvis-uploads');

-- Synced skills per device
CREATE TABLE public.synced_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  skill_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (device_id, skill_id)
);
CREATE INDEX idx_synced_skills_device ON public.synced_skills(device_id);
ALTER TABLE public.synced_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Open read synced_skills" ON public.synced_skills FOR SELECT USING (true);
CREATE POLICY "Open write synced_skills" ON public.synced_skills FOR INSERT WITH CHECK (true);
CREATE POLICY "Open update synced_skills" ON public.synced_skills FOR UPDATE USING (true);
CREATE POLICY "Open delete synced_skills" ON public.synced_skills FOR DELETE USING (true);

-- Synced messages (optional chat backup)
CREATE TABLE public.synced_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  msg_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  ts BIGINT NOT NULL,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (device_id, msg_id)
);
CREATE INDEX idx_synced_messages_device_ts ON public.synced_messages(device_id, ts DESC);
ALTER TABLE public.synced_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Open read synced_messages" ON public.synced_messages FOR SELECT USING (true);
CREATE POLICY "Open write synced_messages" ON public.synced_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Open update synced_messages" ON public.synced_messages FOR UPDATE USING (true);
CREATE POLICY "Open delete synced_messages" ON public.synced_messages FOR DELETE USING (true);

-- Web Push subscriptions
CREATE TABLE public.push_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL UNIQUE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  ua TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Open read push_devices" ON public.push_devices FOR SELECT USING (true);
CREATE POLICY "Open write push_devices" ON public.push_devices FOR INSERT WITH CHECK (true);
CREATE POLICY "Open update push_devices" ON public.push_devices FOR UPDATE USING (true);
CREATE POLICY "Open delete push_devices" ON public.push_devices FOR DELETE USING (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.synced_skills;
ALTER PUBLICATION supabase_realtime ADD TABLE public.synced_messages;