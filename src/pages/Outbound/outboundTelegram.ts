import type { Transaction } from '../../types';

/**
 * Gửi thông báo Telegram khi xuất kho thành công
 */
export const sendTelegramNotification = async (
    title: string,
    transactions: Transaction[],
    productsMap: Record<string, string>,
    receiverOverride?: string
) => {
    if (!transactions || transactions.length === 0) return;
    try {
        const groups: Record<string, any> = {};
        transactions.forEach(t => {
            const pId = t.product_id;
            const pName = productsMap[pId] || 'Unknown';
            const receiver = receiverOverride || t.group_name || t.receiver_group || 'Unknown';
            const key = `${pId}_${receiver}`;
            if (!groups[key]) groups[key] = { pName, receiver, qty: 0, serials: [] };
            groups[key].qty += Number(t.quantity || 1);
            if (t.serial_code) groups[key].serials.push(t.serial_code);
        });

        const escapeHtml = (text: string) =>
            String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        let msg = `✅ <b>${escapeHtml(title)}</b>\n📅 Ngày: ${new Date().toLocaleString('vi-VN')}\n\n`;
        Object.values(groups).forEach(g => {
            msg += `👤 Người nhận: <b>${escapeHtml(g.receiver)}</b>\n📦 Sản phẩm: <b>${escapeHtml(g.pName)}</b>\n🔢 Số lượng: <b>${g.qty}</b>\n`;
            if (g.serials.length > 0)
                msg += `🔤 Serial: ${escapeHtml(g.serials.slice(0, 10).join(', '))}${g.serials.length > 10 ? `... (+${g.serials.length - 10} nữa)` : ''}\n`;
            msg += `---------------------\n`;
        });
        await fetch('/api/telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: msg })
        });
    } catch (e) {
        console.error('Telegram message failed:', e);
    }
};
