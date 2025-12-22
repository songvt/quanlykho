-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Bảng PRODUCTS (DM_HANG_HOA)
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_code TEXT UNIQUE NOT NULL, -- MA_HANG
  name TEXT NOT NULL,             -- TEN_HANG_HOA
  category TEXT,                  -- LOAI_DM
  unit_price NUMERIC DEFAULT 0,   -- DON_GIA
  unit TEXT,                      -- DON_VI
  type TEXT,                      -- LOAI_HANG
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Bảng EMPLOYEES (NHAN_VIEN) - Lưu thông tin bổ sung cho User
-- Lưu ý: User login sẽ được quản lý bởi Supabase Auth (table auth.users)
-- Bảng này map với auth.users qua id hoặc email
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID REFERENCES auth.users(id), -- Link to Supabase Auth
  full_name TEXT NOT NULL,        -- TEN_NHAN_VIEN
  role TEXT DEFAULT 'staff',      -- CHUC_VU (admin, manager, staff)
  email TEXT UNIQUE NOT NULL,     -- EMAIL
  password TEXT,                  -- MAT_KHAU
  must_change_password BOOLEAN DEFAULT TRUE, -- Yeu cau doi mat khau
  username TEXT,                  -- TEN_DANG_NHAP (Added for Import)
  permissions JSONB,              -- PHAN_QUYEN
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Bảng ORDERS (DAT_HANG)
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_group TEXT,           -- NHOM_NHAN_HANG
  product_id UUID REFERENCES products(id), -- Link to MA_HANG
  quantity INTEGER NOT NULL,      -- SO_LUONG
  status TEXT DEFAULT 'pending',  -- Trạng thái
  order_date TIMESTAMPTZ DEFAULT NOW(), -- NGAY_DAT_HANG
  created_by UUID REFERENCES auth.users(id)
);

-- 4. Bảng INBOUND_TRANSACTIONS (NHAP_KHO)
CREATE TABLE inbound_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id), -- MA_HANG
  serial_code TEXT,               -- SERIAL QR CODE (Có thể null nếu hàng không serial)
  quantity INTEGER NOT NULL,      -- SO_LUONG
  unit_price NUMERIC,             -- DON_GIA (Lúc nhập)
  total_price NUMERIC GENERATED ALWAYS AS (quantity * unit_price) STORED, -- THANH_TIEN
  inbound_date TIMESTAMPTZ DEFAULT NOW(), -- NGAY_NHAP_KHO
  created_by UUID REFERENCES auth.users(id)
);

-- 5. Bảng OUTBOUND_TRANSACTIONS (XUAT_KHO)
CREATE TABLE outbound_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receiver_group TEXT,            -- NHOM_NHAN_HANG (Người/Đơn vị nhận)
  product_id UUID REFERENCES products(id), -- MA_HANG
  serial_code TEXT,               -- SERIAL QR CODE
  quantity INTEGER NOT NULL,      -- SO_LUONG
  unit_price NUMERIC,             -- DON_GIA (Lúc xuất)
  total_price NUMERIC GENERATED ALWAYS AS (quantity * unit_price) STORED, -- THANH_TIEN
  outbound_date TIMESTAMPTZ DEFAULT NOW(), -- NGAY_XUAT_KHO
  created_by UUID REFERENCES auth.users(id)
);

-- Row Level Security (RLS) Policies (Basic)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbound_transactions ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users
CREATE POLICY "Allow read access for all authenticated users" ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access for all authenticated users" ON employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access for all authenticated users" ON orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access for all authenticated users" ON inbound_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access for all authenticated users" ON outbound_transactions FOR SELECT TO authenticated USING (true);

-- Allow write access (Customize based on role later)
CREATE POLICY "Allow insert for all authenticated users" ON orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow insert for all authenticated users" ON inbound_transactions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow insert for all authenticated users" ON outbound_transactions FOR INSERT TO authenticated WITH CHECK (true);
