CREATE TABLE IF NOT EXISTS public.bill_notifications (
    id TEXT PRIMARY KEY,
    customer_name TEXT,
    address TEXT,
    phone TEXT,
    service_month TEXT,
    amount TEXT,
    amount_in_words TEXT,
    date_string TEXT,
    collector_name TEXT,
    collector_phone TEXT,
    branch_name TEXT,
    branch_address TEXT,
    branch_contact TEXT,
    branch_services TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.bill_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read-write for bill_notifications" ON public.bill_notifications;
CREATE POLICY "Allow public read-write for bill_notifications" ON public.bill_notifications 
    FOR ALL 
    USING (true) 
    WITH CHECK (true);
