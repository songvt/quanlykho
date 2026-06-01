ALTER TABLE public.zalo_notification_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.zalo_notification_logs;
DROP POLICY IF EXISTS "Enable all for anon" ON public.zalo_notification_logs;

CREATE POLICY "Enable all for authenticated users" ON public.zalo_notification_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON public.zalo_notification_logs FOR ALL TO anon USING (true) WITH CHECK (true);
