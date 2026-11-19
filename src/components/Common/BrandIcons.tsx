import React from 'react';

export interface IconProps {
    size?: number;
    color?: string;
    style?: React.CSSProperties;
    className?: string;
}

// 1. Biểu tượng Microsoft Excel chuẩn thương hiệu
export const ExcelBrandIcon: React.FC<IconProps> = ({ size = 18, style }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', flexShrink: 0, ...style }}>
        <rect x="2.5" y="2.5" width="19" height="19" rx="3.5" fill="#107C41" />
        <path d="M7 7.5L10.5 12L7 16.5H9.2L11.5 13.2L13.8 16.5H16L12.5 12L16 7.5H13.8L11.5 10.8L9.2 7.5H7Z" fill="white" />
    </svg>
);

// 2. Biểu tượng Tải file mẫu Excel (File bảng tính kèm mũi tên tải xuống)
export const TemplateExcelIcon: React.FC<IconProps> = ({ size = 18, color = '#107C41', style }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', flexShrink: 0, ...style }}>
        <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" fill={color} fillOpacity="0.16" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M14 2V8H20" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M12 11V17M12 17L9.5 14.5M12 17L14.5 14.5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

// 3. Biểu tượng Adobe PDF chuẩn thương hiệu
export const PdfBrandIcon: React.FC<IconProps> = ({ size = 18, style }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', flexShrink: 0, ...style }}>
        <rect x="2.5" y="2.5" width="19" height="19" rx="3.5" fill="#E11D48" />
        <path d="M6.5 8.5H9C9.8 8.5 10.5 9.2 10.5 10C10.5 10.8 9.8 11.5 9 11.5H7.8V15.5H6.5V8.5ZM7.8 10.3H8.9C9.1 10.3 9.3 10.1 9.3 10C9.3 9.9 9.1 9.7 8.9 9.7H7.8V10.3Z" fill="white" />
        <path d="M11.5 8.5H13.2C14.5 8.5 15.5 9.5 15.5 10.8V13.2C15.5 14.5 14.5 15.5 13.2 15.5H11.5V8.5ZM12.8 14.3H13.2C13.8 14.3 14.3 13.8 14.3 13.2V10.8C14.3 10.2 13.8 9.7 13.2 9.7H12.8V14.3Z" fill="white" />
        <path d="M16.5 8.5H19.5V9.7H17.8V11.2H19.2V12.4H17.8V15.5H16.5V8.5Z" fill="white" />
    </svg>
);

// 4. Biểu tượng Máy in đồ họa hiện đại (In ấn)
export const PrinterModernIcon: React.FC<IconProps> = ({ size = 18, color = 'currentColor', style }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', flexShrink: 0, ...style }}>
        <path d="M6.5 9V3.5H17.5V9" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M6 18H4.5C3.39543 18 2.5 17.1046 2.5 16V11.5C2.5 10.3954 3.39543 9.5 4.5 9.5H19.5C20.6046 9.5 21.5 10.3954 21.5 11.5V16C21.5 17.1046 20.6046 18 19.5 18H18" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <rect x="6.5" y="14" width="11" height="6.5" rx="1.5" fill={color} fillOpacity="0.25" stroke={color} strokeWidth="1.8"/>
        <circle cx="18" cy="12.5" r="1" fill={color}/>
    </svg>
);

// 5. Biểu tượng Nhập / Upload đám mây
export const CloudUploadCustomIcon: React.FC<IconProps> = ({ size = 18, color = 'currentColor', style }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', flexShrink: 0, ...style }}>
        <path d="M6.5 18C4.01472 18 2 15.9853 2 13.5C2 11.2338 3.67667 9.35987 5.88562 9.04943C6.41724 6.16709 8.9568 4 12 4C15.4093 4 18.2327 6.6438 18.4842 10.0076C20.4851 10.4705 22 12.2606 22 14.4C22 16.9405 19.9405 19 17.4 19H17" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M12 11V21M12 11L8.5 14.5M12 11L15.5 14.5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

// 6. Biểu tượng Thùng rác / Xóa hiện đại
export const TrashCustomIcon: React.FC<IconProps> = ({ size = 18, color = '#EF4444', style }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', flexShrink: 0, ...style }}>
        <path d="M3 6H21" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M8 6V4C8 3.44772 8.44772 3 9 3H15C15.5523 3 16 3.44772 16 4V6M19 6V20C19 20.5523 18.5523 21 18 21H6C5.44772 21 5 20.5523 5 20V6H19Z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M10 11V16M14 11V16" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

// 7. Biểu tượng Zalo chuẩn thương hiệu
export const ZaloBrandIcon: React.FC<IconProps> = ({ size = 18, style }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', flexShrink: 0, ...style }}>
        <rect width="24" height="24" rx="5.5" fill="#0068FF" />
        <path d="M5.5 8.5H11.5L6.5 14.8C6.2 15.2 6.5 15.8 7 15.8H12.5V14.3H8L13 8C13.3 7.6 13 7 12.5 7H5.5V8.5Z" fill="white" />
        <path d="M14.5 11C14.5 9.9 15.4 9 16.5 9C17.6 9 18.5 9.9 18.5 11V15.8H17V11.2C17 10.9 16.8 10.7 16.5 10.7C16.2 10.7 16 10.9 16 11.2V15.8H14.5V11Z" fill="white" />
    </svg>
);

// 8. Biểu tượng Sửa (Edit) tinh tế
export const EditCustomIcon: React.FC<IconProps> = ({ size = 18, color = '#2563EB', style }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', flexShrink: 0, ...style }}>
        <path d="M11 4H4C2.89543 4 2 4.89543 2 6V20C2 21.1046 2.89543 22 4 22H18C19.1046 22 20 21.1046 20 20V13" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M18.5 2.5C19.3284 1.67157 20.6716 1.67157 21.5 2.5C22.3284 3.32843 22.3284 4.67157 21.5 5.5L12 15L8 16L9 12L18.5 2.5Z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

// 9. Biểu tượng Xem chi tiết (View / Eye)
export const ViewCustomIcon: React.FC<IconProps> = ({ size = 18, color = '#0284C7', style }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', flexShrink: 0, ...style }}>
        <path d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

// 10. Biểu tượng Thêm mới (Add / Plus)
export const AddCustomIcon: React.FC<IconProps> = ({ size = 18, color = 'currentColor', style }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', flexShrink: 0, ...style }}>
        <circle cx="12" cy="12" r="9" fill={color} fillOpacity="0.12" stroke={color} strokeWidth="1.8"/>
        <path d="M12 8V16M8 12H16" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

// 11. Biểu tượng Phân quyền / Bảo mật (Key / Security)
export const KeyCustomIcon: React.FC<IconProps> = ({ size = 18, color = '#8B5CF6', style }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', flexShrink: 0, ...style }}>
        <circle cx="8" cy="15" r="4" stroke={color} strokeWidth="1.8"/>
        <path d="M10.85 12.15L19 4M19 4H22V7M19 4V7L16 10" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

// 12. Biểu tượng Làm mới / Đồng bộ (Refresh)
export const RefreshCustomIcon: React.FC<IconProps> = ({ size = 18, color = 'currentColor', style }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', flexShrink: 0, ...style }}>
        <path d="M4 4V9H9" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M20 20V15H15" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M20 9A9 9 0 0 0 6.64 5.64L4 9M4 15A9 9 0 0 0 17.36 18.36L20 15" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

// 13. Biểu tượng QR Code quét & in
export const QrCodeCustomIcon: React.FC<IconProps> = ({ size = 18, color = 'currentColor', style }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', flexShrink: 0, ...style }}>
        <rect x="3" y="3" width="7" height="7" rx="1.5" stroke={color} strokeWidth="1.8"/>
        <rect x="5" y="5" width="3" height="3" fill={color}/>
        <rect x="14" y="3" width="7" height="7" rx="1.5" stroke={color} strokeWidth="1.8"/>
        <rect x="16" y="5" width="3" height="3" fill={color}/>
        <rect x="3" y="14" width="7" height="7" rx="1.5" stroke={color} strokeWidth="1.8"/>
        <rect x="5" y="16" width="3" height="3" fill={color}/>
        <path d="M14 14H17M14 17V20M17 17H20V20" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);
