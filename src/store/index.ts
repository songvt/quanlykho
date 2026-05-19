import { configureStore } from '@reduxjs/toolkit';
import productsReducer from './slices/productsSlice';
import transactionsReducer from './slices/transactionsSlice';
import inventoryReducer from './slices/inventorySlice';
import authReducer from './slices/authSlice';
import employeesReducer from './slices/employeesSlice';
import ordersReducer from './slices/ordersSlice';
import returnsReducer from './slices/returnsSlice';
import assetsReducer from './slices/assetsSlice';
import settlementReducer from './slices/settlementSlice';
import hrProfilesReducer from './slices/hrProfilesSlice';

export const store = configureStore({
    reducer: {
        products: productsReducer,
        transactions: transactionsReducer,
        inventory: inventoryReducer,
        auth: authReducer,
        employees: employeesReducer,
        orders: ordersReducer,
        returns: returnsReducer,
        assets: assetsReducer,
        settlement: settlementReducer,
        hrProfiles: hrProfilesReducer,
    },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
