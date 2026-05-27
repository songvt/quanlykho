import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { InventoryReportItem, DetailedOutboundItem } from '../../types';

type BalanceMap = Record<string, { quantity: number; amount: number; unit_price?: number }>;

interface SettlementState {
    inventoryReportData: InventoryReportItem[];
    detailedOutboundData: DetailedOutboundItem[];
    // Tách riêng đầu kỳ cho 2 báo cáo độc lập, tránh ghi đè lẫn nhau
    supplyInitialBalances: BalanceMap;  // Vật tư
    goodsInitialBalances: BalanceMap;   // Hàng hóa
    /** @deprecated dùng supplyInitialBalances hoặc goodsInitialBalances */
    initialBalances: BalanceMap;
}

const initialState: SettlementState = {
    inventoryReportData: [],
    detailedOutboundData: [],
    supplyInitialBalances: {},
    goodsInitialBalances: {},
    initialBalances: {},
};

const settlementSlice = createSlice({
    name: 'settlement',
    initialState,
    reducers: {
        setInventoryReportData: (state, action: PayloadAction<InventoryReportItem[]>) => {
            state.inventoryReportData = action.payload;
        },
        setDetailedOutboundData: (state, action: PayloadAction<DetailedOutboundItem[]>) => {
            state.detailedOutboundData = action.payload;
        },
        setSupplyInitialBalances: (state, action: PayloadAction<BalanceMap>) => {
            state.supplyInitialBalances = action.payload;
        },
        setGoodsInitialBalances: (state, action: PayloadAction<BalanceMap>) => {
            state.goodsInitialBalances = action.payload;
        },
        /** @deprecated dùng setSupplyInitialBalances hoặc setGoodsInitialBalances */
        setInitialBalances: (state, action: PayloadAction<BalanceMap>) => {
            state.initialBalances = action.payload;
        },
        clearAllSettlementData: (state) => {
            state.inventoryReportData = [];
            state.detailedOutboundData = [];
            state.supplyInitialBalances = {};
            state.goodsInitialBalances = {};
            state.initialBalances = {};
        }
    },
});

export const { 
    setInventoryReportData, 
    setDetailedOutboundData,
    setSupplyInitialBalances,
    setGoodsInitialBalances,
    setInitialBalances, 
    clearAllSettlementData 
} = settlementSlice.actions;

export default settlementSlice.reducer;
