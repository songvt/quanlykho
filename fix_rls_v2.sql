
-- Fix RLS Policies for employee_returns v2 (FORCE FIX)

-- 1. Reset: Drop table policies to start fresh
DROP POLICY IF EXISTS "Allow read access for all authenticated users" ON employee_returns;
DROP POLICY IF EXISTS "Allow insert for all authenticated users" ON employee_returns;
DROP POLICY IF EXISTS "Enable read access for all users" ON employee_returns;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON employee_returns;

-- 2. Force Enable RLS
ALTER TABLE employee_returns ENABLE ROW LEVEL SECURITY;

-- 3. Create BROAD Permissive Policies for Authenticated Users
-- READ: Authenticated users can read ALL rows
CREATE POLICY "Allow read access for all authenticated users"
ON employee_returns
FOR SELECT
TO authenticated
USING (true);

-- INSERT: Authenticated users can insert ANY row
CREATE POLICY "Allow insert for all authenticated users"
ON employee_returns
FOR INSERT
TO authenticated
WITH CHECK (true);

-- UPDATE: Authenticated users can update rows they created OR if they are admins (optional, but good practice)
-- Use a simple "true" for now to debug, can restrict later.
CREATE POLICY "Allow update for all authenticated users"
ON employee_returns
FOR UPDATE
TO authenticated
USING (true);

-- DELETE: Authenticated users can delete rows (or restrict to admins)
CREATE POLICY "Allow delete for all authenticated users"
ON employee_returns
FOR DELETE
TO authenticated
USING (true);

-- 4. Grant Permissions on Table and Sequence
GRANT ALL ON employee_returns TO postgres;
GRANT ALL ON employee_returns TO service_role;
GRANT ALL ON employee_returns TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 5. Fix Inbound Transactions (Just in case)
DROP POLICY IF EXISTS "Allow insert for all authenticated users" ON inbound_transactions;
CREATE POLICY "Allow insert for all authenticated users"
ON inbound_transactions
FOR INSERT
TO authenticated
WITH CHECK (true);
