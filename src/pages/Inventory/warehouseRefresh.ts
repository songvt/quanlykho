export const WAREHOUSE_AUTO_REFRESH_MS = 5 * 60 * 1000;

export const shouldAutoRefreshWarehouse = (visibilityState: DocumentVisibilityState) =>
    visibilityState === 'visible';
