
-- Fix RLS Policies for employee_returns

-- 1. Ensure Table Exists (If not already)
-- Note: 'IF NOT EXISTS' prevents error if it exists.
CREATE TABLE IF NOT EXISTS employee_returns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id),
  serial_code TEXT,
  quantity INTEGER DEFAULT 1,
  reason TEXT CHECK (reason IN ('Hàng tồn lâu', 'Hàng mới hỏng', 'Hàng thu hồi khách hàng rời mạng')),
  unit_price NUMERIC DEFAULT 0,
  total_price NUMERIC GENERATED ALWAYS AS (quantity * unit_price) STORED,
  return_date TIMESTAMPTZ DEFAULT NOW(),
  employee_id UUID REFERENCES employees(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE employee_returns ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies to avoid conflicts or stale logic
DROP POLICY IF EXISTS "Allow read access for all authenticated users" ON employee_returns;
DROP POLICY IF EXISTS "Allow insert for all authenticated users" ON employee_returns;
DROP POLICY IF EXISTS "Enable read access for all users" ON employee_returns;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON employee_returns;

-- 4. Re-create Policies (Clean Slate)

-- Allow SELECT for all authenticated users (Employees need to see their returns, Admins see all)
-- For simplicity, we allow all authenticated users to see all records.
-- If you want employees to see ONLY their own returns, change USING (true) to USING (auth.uid() = created_by OR auth.uid() IN (SELECT auth_user_id FROM employees WHERE role IN ('admin', 'manager')))
CREATE POLICY "Allow read access for all authenticated users"
ON employee_returns FOR SELECT
TO authenticated
USING (true);

-- Allow INSERT for all authenticated users
CREATE POLICY "Allow insert for all authenticated users"
ON employee_returns FOR INSERT
TO authenticated
WITH CHECK (true);

-- 5. Grant Permissions (Often needed if public role or specific roles are used, but for 'authenticated' usually automatic)
GRANT ALL ON employee_returns TO authenticated;
GRANT ALL ON employee_returns TO service_role;
