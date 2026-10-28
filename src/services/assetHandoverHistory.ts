export const saveAssetHandoverHistory = async (payload: unknown, fetcher: typeof fetch = fetch) => {
    const response = await fetcher('/api/asset_handovers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result?.success || !result?.data) {
        throw new Error(result?.error || 'Không thể lưu lịch sử bàn giao.');
    }

    return result.data;
};
