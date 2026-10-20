-- Fix schema mismatch for the Outbound form.
-- The UI records the source warehouse in `warehouse_type`; without this column
-- PostgREST rejects every export request before a transaction can be created.
ALTER TABLE public.outbound_transactions
  ADD COLUMN IF NOT EXISTS warehouse_type TEXT;

-- These fields are already used by the current outbound payload.  Keeping this
-- migration idempotent makes it safe for databases created from older schemas.
ALTER TABLE public.outbound_transactions
  ADD COLUMN IF NOT EXISTS group_name TEXT,
  ADD COLUMN IF NOT EXISTS receiver_name TEXT,
  ADD COLUMN IF NOT EXISTS district TEXT,
  ADD COLUMN IF NOT EXISTS item_status TEXT,
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Ask PostgREST (the Supabase REST layer) to refresh its schema immediately.
NOTIFY pgrst, 'reload schema';
