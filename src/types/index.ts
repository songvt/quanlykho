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
    check?: string; // Cảnh báo / ghi chú nội bộ
}

export interface Product {
    id: string;
    item_code: string; // MA_HANG
    name: string;      // TEN_HANG_HOA
    category: string;  // LOAI_DM
    unit_price: number; // DON_GIA
    unit: string;      // DON_VI
    type?: string;     // LOAI_HANG
    description?: string;
    brand?: string;
    specifications?: string;
    image_url?: string;
    min_stock?: number;
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
    reason?: string;      // Ghi chú / cảnh báo từ cột Check của nhân viên
    project_name?: string;
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
    // New fields for schema alignment
    sap_id?: string;
    tc_id?: string;
    item_type?: string;
    warehouse_type?: string;
    full_name?: string;
    // Join fields
    product?: Product;
    product_name?: string; // Tên sản phẩm (đã join)
    user_name?: string; // Tên nhân viên thực hiện (created_by)
    receiver_group?: string; // Tên nhóm/người nhận
    receiver_name?: string; // Tên người nhận (đã join)
    outbound_date?: string; // Ngày xuất kho
    inbound_date?: string; // Ngày nhập kho
    created_by?: string;   // Người thực hiện (email hoặc tên)
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
    reason: 'Hàng tồn lâu' | 'Hàng mới hỏng' | 'Hàng thu hồi khách hàng rời mạng' | 'Trả hàng KH nâng cấp Mesh';
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
