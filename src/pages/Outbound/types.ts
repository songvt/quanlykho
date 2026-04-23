// Outbound module shared types

export interface OutboundTransaction {
    id: string;
    product_id: string;
    product_name: string;
    quantity: number;
    serial_code?: string;
    group_name: string;
    unit_price: number;
    total_price: number;
    date: string;
    district?: string;
    item_status?: string;
}

export interface OutboundFormState {
    selectedProduct: string;
    quantity: number;
    serial: string;
    receiver: string;
    district: string;
    itemStatus: string;
    scannedSerials: string[];
}
