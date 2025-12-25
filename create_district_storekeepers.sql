-- Create table for mapping Districts to Storekeeper Names
CREATE TABLE IF NOT EXISTS district_storekeepers (
    district TEXT PRIMARY KEY,
    storekeeper_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE district_storekeepers ENABLE ROW LEVEL SECURITY;

-- Everyone can view (for printing reports)
CREATE POLICY "Enable read access for all users" ON district_storekeepers
    FOR SELECT USING (true);

-- Only Admin can insert/update/delete
CREATE POLICY "Enable write access for admins only" ON district_storekeepers
    FOR ALL USING (
        auth.uid() IN (
            SELECT auth_user_id FROM employees WHERE role = 'admin'
        )
    );
