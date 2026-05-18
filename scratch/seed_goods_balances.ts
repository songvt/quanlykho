
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

const goodsOpeningBalances = [
  { item_name: "Home Wifi chuẩn Wifi 6_HV3601P_UCTT", item_code: "ZXHN_HV3601P_UCT", sap_item_code: "01040849135", unit: "Chiếc", unit_price: 350000, opening_qty: 7, opening_amount: 2450000 },
  { item_name: "Home Wifi 6 VHT 32X6V1", item_code: "HWF_vAP_32X6V1", sap_item_code: "01040853629", unit: "Cái", unit_price: 413000, opening_qty: 39, opening_amount: 16107000 },
  { item_name: "TM_TBĐC Settopbox 2 chiều IP Hisense IP826_UC3", item_code: "TM_STB2C-IP826_UC3", sap_item_code: "010406237", unit: "Chiếc", unit_price: 30000, opening_qty: 5, opening_amount: 150000 },
  { item_name: "Camera trong nhà HC24", item_code: "CAMPTZ_T3_HC24", sap_item_code: "01040860843", unit: "Bộ", unit_price: 260000, opening_qty: 118, opening_amount: 30680000 },
  { item_name: "Điện thoại IP GXP1610", item_code: "IP_GXP1610", sap_item_code: "01071279", unit: "Chiếc", unit_price: 590000, opening_qty: 2, opening_amount: 1180000 },
  { item_name: "ONT wifi 6 VHT vGP-42X6V1", item_code: "42X6V1", sap_item_code: "01040853628", unit: "Cái", unit_price: 550000, opening_qty: 1137, opening_amount: 625350000 },
  { item_name: "ONT GWN7062G cho KHDN", item_code: "GWN7062G", sap_item_code: "01040850031", unit: "Cái", unit_price: 1690000, opening_qty: 5, opening_amount: 8450000 },
  { item_name: "Home Wifi chuẩn Wifi 6_HV3601P", item_code: "ZXHN_HV3601P", sap_item_code: "01040849135", unit: "Cái", unit_price: 350000, opening_qty: 20, opening_amount: 7000000 },
  { item_name: "Camera trong nhà HC23 3M_UCTT", item_code: "CAMPTZ_JF_HC23_3M UCTT", sap_item_code: "01040849169", unit: "Bộ", unit_price: 313000, opening_qty: 2, opening_amount: 626000 },
  { item_name: "ONT 4 cổng Dualband Wifi 6 ZTE_F6601P_UCTT", item_code: "ZXHN_F6601P_UCTT", sap_item_code: "01040849134", unit: "Chiếc", unit_price: 470000, opening_qty: 19, opening_amount: 8930000 },
  { item_name: "TM_ATV_HISENSE_IP952_STB Android TV 4K_UC3", item_code: "TM_ATV_IP952_UC3", sap_item_code: "500002651", unit: "Cái", unit_price: 156333, opening_qty: 7, opening_amount: 1094331 },
  { item_name: "ONT wifi 6 VHT vGP-42X6V1_UCTT", item_code: "42X6V1_UCTT", sap_item_code: "", unit: "Cái", unit_price: 550000, opening_qty: 184, opening_amount: 101200000 },
  { item_name: "Thiết bị ONT XS0426GP", item_code: "XS0426GP", sap_item_code: "", unit: "Cái", unit_price: 1196000, opening_qty: 52, opening_amount: 62192000 },
  { item_name: "ONT WiFi 6 NPE3036GV", item_code: "NPE3036GV", sap_item_code: "", unit: "Cái", unit_price: 392000, opening_qty: 173, opening_amount: 86500000 },
  { item_name: "Home WiFi 6 NR3053", item_code: "HWF_NR3053", sap_item_code: "", unit: "Cái", unit_price: 500000, opening_qty: 538, opening_amount: 210896000 },
  { item_name: "ONT WiFi 6 NPE3036GV_UCTT", item_code: "NPE3036GV_UCTT", sap_item_code: "", unit: "Cái", unit_price: 500000, opening_qty: 12, opening_amount: 6000000 },
  { item_name: "Card Gateway 4 cổng FXS_UCTT", item_code: "ATA4C_UCTT", sap_item_code: "", unit: "Cái", unit_price: 2230000, opening_qty: 1, opening_amount: 2230000 },
  { item_name: "STB Android TV 4K AV1_ZTE_B866V6M", item_code: "AV1_ZTE_B866V6M", sap_item_code: "", unit: "Cái", unit_price: 483300, opening_qty: 268, opening_amount: 129524400 },
  { item_name: "TM_Home Wifi 6 VHT 32X6V1_UC1", item_code: "TM_HWF_vAP_32X6V1_UC1", sap_item_code: "", unit: "Cái", unit_price: 413000, opening_qty: 7, opening_amount: 2891000 },
  { item_name: "TM_ONT Dualband vG-421WD_UC3", item_code: "TM_VT-421WD_UC3", sap_item_code: "", unit: "Cái", unit_price: 45455, opening_qty: 2, opening_amount: 90910 },
  { item_name: "Home Wifi 6 ZTE HV3601P_V9.3_UCTT", item_code: "HWF_ZTE3601P_V9.3_UCTT", sap_item_code: "", unit: "Cái", unit_price: 375000, opening_qty: 10, opening_amount: 3750000 },
  { item_name: "Fullbox KD_ONT 4 cổng Dualband Wifi 6 ZTE_F6601P_TH2", item_code: "ZXHN_F6601P_Fullbox_TH2", sap_item_code: "", unit: "Cái", unit_price: 142000, opening_qty: 35, opening_amount: 4970000 },
  { item_name: "Home WiFi 6 NR3053_UCTT", item_code: "HWF_NR3053_UCTT", sap_item_code: "", unit: "Cái", unit_price: 392000, opening_qty: 8, opening_amount: 3136000 },
  { item_name: "TM_ATV-SKYWORTH- HP40A-STB Android TV 4K_BH_UC3", item_code: "TM_ATV-SKYWORTH-HP40A_BH_UC3", sap_item_code: "", unit: "Cái", unit_price: 86800, opening_qty: 1, opening_amount: 86800 },
  { item_name: "TM_Homewifi Dualband ZTE H196A_BH_UC2", item_code: "TM_HWF_H196A_BH_UC2", sap_item_code: "", unit: "Cái", unit_price: 64800, opening_qty: 101, opening_amount: 6544800 },
  { item_name: "Thân Camera trong nhà HC23 3M_TH2_UCTT", item_code: "CAMPTZ_JF_HC23_3M_TH2_TM_UCTT", sap_item_code: "", unit: "Cái", unit_price: 27137, opening_qty: 8, opening_amount: 217096 },
  { item_name: "Camera ngoài trời HC34_3M", item_code: "CAMMOD_T3_HC34_3M", sap_item_code: "", unit: "Cái", unit_price: 402000, opening_qty: 61, opening_amount: 24522000 },
  { item_name: "Cảm biến khói wifi PA-443", item_code: "PA443", sap_item_code: "", unit: "Cái", unit_price: 274000, opening_qty: 168, opening_amount: 46032000 },
  { item_name: "KD_TBĐC Settopbox_STB Android 4K_ATV_IP952_Fullbox_TH3", item_code: "ATV_IP952_Fullbox_TH3", sap_item_code: "", unit: "Cái", unit_price: 273680, opening_qty: 57, opening_amount: 15599760 },
  { item_name: "KD_TBĐC Settopbox_STB Android TV 4K_TV360_ATV_SDMC_DV9135_Fullbox_TH3", item_code: "TV360_ATV_SDMC_DV9135_Fullbox_TH3", sap_item_code: "", unit: "Cái", unit_price: 284300, opening_qty: 32, opening_amount: 9097600 },
  { item_name: "TM_TV360_ATV_ICTECH_IP151N _STB Android TV 4K_UC3", item_code: "TM_TV360_ATV_ICTECH_IP151N_UC3", sap_item_code: "", unit: "Cái", unit_price: 150000, opening_qty: 30, opening_amount: 4500000 }
];

async function seed() {
  console.log('Starting seed for April 2026 Goods Settlement (31 items)...');
  const month = '2026-04';
  
  const payload = goodsOpeningBalances.map(item => ({
    month,
    item_code: item.item_code,
    item_name: item.item_name,
    unit: item.unit,
    unit_price: item.unit_price,
    opening_qty: item.opening_qty,
    opening_amount: item.opening_amount,
    inbound_qty: 0,
    inbound_amount: 0,
    outbound_qty: 0,
    outbound_amount: 0,
    usage_qty: 0,
    usage_amount: 0,
    return_qty: 0,
    return_amount: 0,
    closing_qty: item.opening_qty,
    closing_amount: item.opening_amount,
    sap_item_code: item.sap_item_code,
    finance_item_name: item.item_name
  }));

  const { error } = await supabase
    .from('settlement_history')
    .upsert(payload, { onConflict: 'month,item_code' });

  if (error) {
    console.error('Seed failed:', error);
  } else {
    console.log(`Seed successful! Added/Updated ${payload.length} items for May 2026.`);
  }
}

seed();
