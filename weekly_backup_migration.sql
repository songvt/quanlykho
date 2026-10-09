-- Stores encrypted-at-rest weekly application snapshots. Run through the normal Supabase migration process.
CREATE TABLE IF NOT EXISTS system_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_type TEXT NOT NULL DEFAULT 'weekly',
  payload JSONB NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_backups_type_created_at
  ON system_backups (backup_type, created_at DESC);

ALTER TABLE system_backups ENABLE ROW LEVEL SECURITY;
-- No client policy: snapshots may contain sensitive operational and employee data.
-- The server-side SUPABASE_SERVICE_ROLE_KEY bypasses RLS for the scheduled job.
