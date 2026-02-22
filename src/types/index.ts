// Permission Codes
export type PermissionCode =
    | 'inventory.view' | 'inventory.manage'
    | 'inbound.view' | 'inbound.create'
    | 'outbound.view' | 'outbound.create'
    | 'orders.create' | 'orders.view_own' | 'orders.view_all' | 'orders.approve' | 'orders.delete'
    | 'reports.view_all' | 'reports.handover'
    | 'employees.view' | 'employees.manage'
    | 'returns.view' | 'returns.create'
    | 'storekeepers.manage'
    | '*'; // Admin full access

export interface Employee {
    id: string;
    auth_user_id?: string;
    full_name: string;
    username?: string; // Legacy support or display name
    role: 'admin' | 'manager' | 'staff';
    email: string;
    phone_number?: string; // SO_DIEN_THOAI
    district?: string;
    password?: string;
    must_change_password?: boolean;
    permissions?: PermissionCode[];
}

export interface Product {
    id: string;
    item_code: string; // MA_HANG
    name: string;      // TEN_HANG_HOA
    category: string;  // LOAI_DM
    unit_price: number; // DON_GIA
    unit: string;      // DON_VI
    type?: string;     // LOAI_HANG
}

export interface Order {
    id: string;
    requester_group: string;
    product_id: string;
    quantity: number;
    status: 'pending' | 'approved' | 'rejected' | 'completed';
    order_date: string;
    created_at?: string;
    updated_at?: string;
    created_by?: string;
    approved_by?: string;
    approved_at?: string;
    // Join fields
    product?: Product;
}

export interface Transaction {
    id: string;
    type: 'inbound' | 'outbound';
    group_name: string; // NHOM_NHAN_HANG (requester/receiver)
    district?: string; // QUAN_HUYEN
    item_status?: string; // TRANG_THAI_HANG
    product_id: string;
    serial_code?: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    date: string; // DATE or DATETIME from SQL
    // Join fields
    product?: Product;
    user_name?: string; // Tên nhân viên thực hiện (created_by)
}

export interface DashboardStats {
    total_products: number;
    total_inventory: number;
    low_stock_items: number;
    out_of_stock_items: number;
    recent_transactions: Transaction[];
    weekly_stats: { date: string; inbound: number; outbound: number }[];
    category_stats: { name: string; value: number }[];
}

export interface FifoAgingItem {
    id: string; // Transaction ID
    product_name: string;
    item_code: string;
    inbound_date: string;
    serial_code?: string;
    quantity_remaining: number;
    days_in_stock: number;
}

export interface EmployeeReturn {
    id: string;
    product_id: string;
    serial_code?: string;
    quantity: number;
    reason: 'Hàng tồn lâu' | 'Hàng mới hỏng' | 'Hàng thu hồi khách hàng rời mạng';
    unit_price: number;
    total_price: number;
    return_date: string;
    employee_id: string;
    created_at: string;
    created_by?: string;
    // Joins
    product?: Product;
    employee?: Employee;
}
