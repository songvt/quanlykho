import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { InventoryReportItem, DetailedOutboundItem } from '../../types';

interface SettlementState {
    inventoryReportData: InventoryReportItem[];
    detailedOutboundData: DetailedOutboundItem[];
    initialBalances: Record<string, { quantity: number; amount: number; unit_price?: number }>;
}

const initialState: SettlementState = {
    inventoryReportData: [],
    detailedOutboundData: [],
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
        setInitialBalances: (state, action: PayloadAction<Record<string, { quantity: number; amount: number; unit_price?: number }>>) => {
            state.initialBalances = action.payload;
        },
        clearAllSettlementData: (state) => {
            state.inventoryReportData = [];
            state.detailedOutboundData = [];
            state.initialBalances = {};
        }
    },
});

export const { 
    setInventoryReportData, 
    setDetailedOutboundData, 
    setInitialBalances, 
    clearAllSettlementData 
} = settlementSlice.actions;

export default settlementSlice.reducer;
