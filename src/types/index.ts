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
    permissions?: any;
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
    created_by?: string;
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
