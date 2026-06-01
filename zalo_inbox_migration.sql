CREATE TABLE IF NOT EXISTS public.zalo_bot_inbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zalo_user_id TEXT NOT NULL,
    message_id TEXT UNIQUE NOT NULL,
    sender_name TEXT,
    message_content TEXT,
    bot_token TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.zalo_bot_inbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all for authenticated users on zalo_bot_inbox" ON public.zalo_bot_inbox;
DROP POLICY IF EXISTS "Enable all for anon on zalo_bot_inbox" ON public.zalo_bot_inbox;

CREATE POLICY "Enable all for authenticated users on zalo_bot_inbox" ON public.zalo_bot_inbox FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon on zalo_bot_inbox" ON public.zalo_bot_inbox FOR ALL TO anon USING (true) WITH CHECK (true);
