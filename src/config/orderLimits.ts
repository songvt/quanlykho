/**
 * Giới hạn số lượng đặt hàng theo từng mặt hàng (theo tên sản phẩm).
 * Các mặt hàng không có trong danh sách này sẽ không bị giới hạn (chỉ giới hạn bởi tồn kho).
 */
export const ORDER_QUANTITY_LIMITS: Record<string, number> = {
    "Cáp quang bọc chặt 1FO HDPE 2 sợi thép": 1000,
    "Fast connector SC/APC KT": 20,
    "ONT 4 cổng Dualband Wifi 6 ZTE_F6601P": 20,
    "Home WiFi 6 NR3053": 18,
    "ONT WiFi 6 NPE3036GV": 20,
    "Camera trong nhà HC24": 20,
    "ATV_HISENSE_IP952_STB Android TV 4K": 20,
    "ONT dual band wifi 6 HG8041X6-12_UCTT": 2,
    "Home Wifi 6 VHT 32X6V1": 24,
    "ONT wifi 6 VHT vGP-42X6V1": 24,
    "Rệp quang GPON DYS": 5,
    "ONT 4 cổng Dualband Wifi 6 ZTE_F6601P_UCTT": 2,
    "ONT 4 cổng Dualband Wifi 6 ZTE_F6601P_BH_UC1": 2,
    "ONT dual band wifi 6 HG8041X6-12": 20,
    "ONT wifi 6 VHT vGP-42X6V1_UCTT": 2,
    "Home Wifi 6 ZTE HV3601P_V9.3": 10,
    "Fast connector SC/APC DYS": 20,
};

/**
 * Lấy giới hạn số lượng đặt hàng cho một sản phẩm theo tên.
 * @returns số giới hạn nếu có, hoặc null nếu không giới hạn.
 */
export function getOrderLimit(productName: string): number | null {
    // Tìm chính xác trước
    if (Object.prototype.hasOwnProperty.call(ORDER_QUANTITY_LIMITS, productName)) {
        return ORDER_QUANTITY_LIMITS[productName];
    }
    // Tìm kiếm gần đúng (case-insensitive, ignore whitespace)
    const normalizedInput = productName.trim().toLowerCase();
    for (const [key, limit] of Object.entries(ORDER_QUANTITY_LIMITS)) {
        if (key.trim().toLowerCase() === normalizedInput) {
            return limit;
        }
    }
    return null;
}
