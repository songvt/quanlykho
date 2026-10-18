-- Lịch sử kiểm kê định kỳ tài sản. Chạy migration này trên Supabase trước khi triển khai.
CREATE TABLE IF NOT EXISTS periodic_asset_audits (
    id UUID PRIMARY KEY,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    asset_code TEXT NOT NULL,
    asset_name TEXT NOT NULL,
    status TEXT,
    location_name TEXT,
    user_employee_name TEXT,
    manager_name TEXT,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    checked_by TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS periodic_asset_audits_checked_at_idx ON periodic_asset_audits (checked_at DESC);
CREATE INDEX IF NOT EXISTS periodic_asset_audits_asset_id_idx ON periodic_asset_audits (asset_id);

ALTER TABLE periodic_asset_audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read periodic asset audits" ON periodic_asset_audits FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create periodic asset audits" ON periodic_asset_audits FOR INSERT TO authenticated WITH CHECK (true);
