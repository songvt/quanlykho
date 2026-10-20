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

        const heading = `✅ <b>${escapeHtml(title)}</b>\n📅 Ngày: ${new Date().toLocaleString('vi-VN')}\n\n`;
        // Telegram limits a message to 4,096 characters.  Keep every serial,
        // but split exceptionally large outbound batches into readable parts.
        const maxMessageLength = 3_800;
        const messages: string[] = [];

        Object.values(groups).forEach((g: any) => {
            const detail = `👤 Người nhận: <b>${escapeHtml(g.receiver)}</b>\n📦 Sản phẩm: <b>${escapeHtml(g.pName)}</b>\n🔢 Số lượng: <b>${g.qty}</b>\n`;
            if (g.serials.length === 0) {
                messages.push(`${heading}${detail}---------------------`);
                return;
            }

            let serialPart = `${heading}${detail}🔤 Serial xuất:\n`;
            g.serials.forEach((serial: string, index: number) => {
                const serialLine = `${index + 1}. <code>${escapeHtml(serial)}</code>\n`;
                if (serialPart.length + serialLine.length > maxMessageLength) {
                    messages.push(serialPart.trimEnd());
                    serialPart = `${heading}${detail}🔤 Serial xuất (tiếp):\n`;
                }
                serialPart += serialLine;
            });
            messages.push(serialPart.trimEnd());
        });

        for (const text of messages) {
            const response = await fetch('/api/telegram', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            if (!response.ok) throw new Error(`Không gửi được thông báo (${response.status})`);
        }
    } catch (e) {
        console.error('Telegram message failed:', e);
    }
};
