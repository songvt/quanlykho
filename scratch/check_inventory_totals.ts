import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
    const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);
    const { data: dbData, error } = await supabase
        .from('settlement_inventory_data')
        .select('*')
        .in('month', ['2026-04', '2026-4', '4/2026', '04/2026']);
        
    if (error) {
        console.error('Error fetching data:', error);
        return;
    }

    // Bản đồ mã chuẩn
    const STANDARD_GOODS_31_DATA = [
        { name: "Home Wifi chuẩn Wifi 6_HV3601P_UCTT", code: "ZXHN_HV3601P_UCT" },
        { name: "Home Wifi 6 VHT 32X6V1", code: "HWF_vAP_32X6V1" },
        { name: "TM_TBĐC Settopbox 2 chiều IP Hisense IP826_UC3", code: "TM_STB2C-IP826_UC3" },
        { name: "Camera trong nhà HC24", code: "CAMPTZ_T3_HC24" },
        { name: "Điện thoại IP GXP1610", code: "IP_GXP1610" },
        { name: "ONT wifi 6 VHT vGP-42X6V1", code: "42X6V1" },
        { name: "ONT GWN7062G cho KHDN", code: "GWN7062G" },
        { name: "Home Wifi chuẩn Wifi 6_HV3601P", code: "ZXHN_HV3601P" },
        { name: "Camera trong nhà HC23 3M_UCTT", code: "CAMPTZ_JF_HC23_3M UCTT" },
        { name: "ONT 4 cổng Dualband Wifi 6 ZTE_F6601P_UCTT", code: "ZXHN_F6601P_UCTT" },
        { name: "TM_ATV_HISENSE_IP952_STB Android TV 4K_UC3", code: "TM_ATV_IP952_UC3" },
        { name: "ONT wifi 6 VHT vGP-42X6V1_UCTT", code: "42X6V1_UCTT" },
        { name: "Thiết bị ONT XS0426GP", code: "XS0426GP" },
        { name: "ONT WiFi 6 NPE3036GV", code: "NPE3036GV" },
        { name: "Home WiFi 6 NR3053", code: "HWF_NR3053" },
        { name: "ONT WiFi 6 NPE3036GV_UCTT", code: "NPE3036GV_UCTT" },
        { name: "Card Gateway 4 cổng FXS_UCTT", code: "ATA4C_UCTT" },
        { name: "STB Android TV 4K AV1_ZTE_B866V6M", code: "AV1_ZTE_B866V6M" },
        { name: "TM_Home Wifi 6 VHT 32X6V1_UC1", code: "TM_HWF_vAP_32X6V1_UC1" },
        { name: "TM_ONT Dualband vG-421WD_UC3", code: "TM_VT-421WD_UC3" },
        { name: "Home Wifi 6 ZTE HV3601P_V9.3_UCTT", code: "HWF_ZTE3601P_V9.3_UCTT" },
        { name: "Fullbox KD_ONT 4 cổng Dualband Wifi 6 ZTE_F6601P_TH2", code: "ZXHN_F6601P_Fullbox_TH2" },
        { name: "Home WiFi 6 NR3053_UCTT", code: "HWF_NR3053_UCTT" },
        { name: "TM_ATV-SKYWORTH- HP40A-STB Android TV 4K_BH_UC3", code: "TM_ATV-SKYWORTH-HP40A_BH_UC3" },
        { name: "TM_Homewifi Dualband ZTE H196A_BH_UC2", code: "TM_HWF_H196A_BH_UC2" },
        { name: "Thân Camera trong nhà HC23 3M_TH2_UCTT", code: "CAMPTZ_JF_HC23_3M_TH2_TM_UCTT" },
        { name: "Camera ngoài trời HC34_3M", code: "CAMMOD_T3_HC34_3M" },
        { name: "Cảm biến khói wifi PA-443", code: "PA443" },
        { name: "KD_TBĐC Settopbox_STB Android 4K_ATV_IP952_Fullbox_TH3", code: "ATV_IP952_Fullbox_TH3" },
        { name: "KD_TBĐC Settopbox_STB Android TV 4K_TV360_ATV_SDMC_DV9135_Fullbox_TH3", code: "TV360_ATV_SDMC_DV9135_Fullbox_TH3" },
        { name: "TM_TV360_ATV_ICTECH_IP151N _STB Android TV 4K_UC3", code: "TM_TV360_ATV_ICTECH_IP151N_UC3" }
    ];

    const standardCodeMap = new Map<string, string>();
    STANDARD_GOODS_31_DATA.forEach(item => {
        if (item.code) standardCodeMap.set(item.code.trim().toLowerCase(), item.name);
    });

    const findStandardKey = (name: string, code?: string) => {
        if (code) {
            const normalizedCode = code.trim().toLowerCase();
            if (standardCodeMap.has(normalizedCode)) return standardCodeMap.get(normalizedCode)!;
        }
        if (!name) return null;
        const normalizedName = name.trim().toLowerCase().replace(/\s+/g, ' ');
        const exactMatch = STANDARD_GOODS_31_DATA.find(item => item.name.toLowerCase().replace(/\s+/g, ' ') === normalizedName);
        return exactMatch ? exactMatch.name : null;
    };

    // Đúng theo hình ảnh của người dùng gửi
    const correctData: Record<string, { qty: number, amt: number }> = {
        "Camera trong nhà HC24": { qty: 440, amt: 114400000 },
        "ONT wifi 6 VHT vGP-42X6V1": { qty: 192, amt: 105600000 },
        "ONT GWN7062G cho KHDN": { qty: 7, amt: 11830000 },
        "GPDN TBCĐ ONT Dualband Dasan H646GMV": { qty: 5, amt: 3590000 },
        "Camera ngoài trời HC33_UCTT": { qty: 2, amt: 1380000 },
        "ONT dual band wifi 6 HG8041X6-12": { qty: 860, amt: 430000000 },
        "ONT WiFi 6 NPE3036GV": { qty: 440, amt: 220000000 },
        "Home WiFi 6 NR3053": { qty: 620, amt: 243040000 },
        "STB Android TV 4K AV1_ZTE_B866V6M": { qty: 220, amt: 106326000 },
        "Camera ngoài trời HC34_3M": { qty: 60, amt: 24120000 },
        "Thiết bị ONT XS0426GP_UCTT": { qty: 6, amt: 7176000 }
    };

    const totals: Record<string, { inbound_qty: number, inbound_amount: number, return_qty: number }> = {};

    dbData?.forEach((item: any) => {
        const rawName = (item.bccs_item || item.item_name || "").trim();
        const rawCode = (item.item_code || "").trim();
        
        let key = findStandardKey(rawName, rawCode);
        if (!key) {
            const excelCat = String(item.note || '').toLowerCase();
            if (excelCat.includes('hàng hóa') || excelCat.includes('hang hoa')) {
                key = rawName;
            }
        }

        if (key) {
            if (!totals[key]) {
                totals[key] = { inbound_qty: 0, inbound_amount: 0, return_qty: 0 };
            }

            const qty = Number(item.quantity) || 0;
            const amt = Number(item.total_amount) || 0;
            const type = (item.transaction_type || '').toLowerCase();

            if (type.includes('nhập')) {
                totals[key].inbound_qty += qty;
                totals[key].inbound_amount += amt;
            } else if (type.includes('xuất')) {
                totals[key].return_qty += qty;
            }
        }
    });

    console.log('\n--- BẢNG ĐỐI CHIẾU SỐ LIỆU NHẬP TRONG KỲ ---');
    console.log('Tên hàng hóa | Số lượng (Hệ thống) | Số lượng (Đúng) | Lệch Qty | Thành tiền (Hệ thống) | Thành tiền (Đúng) | Lệch Tiền');
    console.log('-------------------------------------------------------------------------------------------------------------');
    for (const [name, correct] of Object.entries(correctData)) {
        const sys = totals[name] || { inbound_qty: 0, inbound_amount: 0 };
        const diffQty = sys.inbound_qty - correct.qty;
        const diffAmt = sys.inbound_amount - correct.amt;
        console.log(`${name} | ${sys.inbound_qty} | ${correct.qty} | ${diffQty} | ${sys.inbound_amount.toLocaleString('vi-VN')} | ${correct.amt.toLocaleString('vi-VN')} | ${diffAmt.toLocaleString('vi-VN')}`);
    }
    console.log('-------------------------------------------------------------------------------------------------------------');
}

run();
