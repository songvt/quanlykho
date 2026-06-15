import { VercelRequest, VercelResponse } from '@vercel/node';
import { uploadToGoogleDrive } from './_utils/googleDrive.js';

// Helper to send notifications to both Telegram and Zalo Bot
async function sendSystemNotification(text: string) {
    // Send to Telegram if configured
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (token && chatId) {
        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
            });
            if (!response.ok) {
                console.error(`Lỗi gửi tin Telegram. Status: ${response.status}`);
            }
        } catch (err) {
            console.error('Lỗi kết nối Telegram:', err);
        }
    }

    // Send to Zalo Bot if configured
    const zaloToken = process.env.ZALO_BOT_TOKEN;
    const zaloChatId = process.env.ZALO_BOT_CHAT_ID;
    if (zaloToken && zaloChatId) {
        const cleanText = text.replace(/<[^>]*>/g, ''); // Remove HTML tags for Zalo
        const ids = zaloChatId.split(',').map((id: string) => id.trim());
        
        const promises = ids.map(async (id) => {
            try {
                const response = await fetch(`https://bot-api.zaloplatforms.com/bot${zaloToken}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: id, text: cleanText })
                });
                const resData = await response.json();
                if (!response.ok || !resData.ok) {
                    console.error(`Lỗi gửi tin Zalo Bot đến ${id}:`, resData);
                } else {
                    console.log(`Đã gửi tin Zalo Bot thành công đến ${id}`);
                }
            } catch (err) {
                console.error(`Lỗi kết nối Zalo Bot đến ${id}:`, err);
            }
        });
        await Promise.all(promises);
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { type } = req.query;

    try {
        if (type === 'drive_upload') {
            const { fileName, mimeType, fileData } = req.body;

            if (!fileData) {
                return res.status(400).json({ error: 'No file data provided' });
            }

            const buffer = Buffer.from(fileData, 'base64');
            const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '1eAusIt6z7bcunlAPFe99ipMh1ZB2zCWE';
            
            const result = await uploadToGoogleDrive(
                buffer,
                fileName || `document_${Date.now()}.pdf`,
                mimeType || 'application/pdf',
                folderId
            );

            // Send notification to Telegram/Zalo
            const fileLink = (result as any)?.webViewLink || (result as any)?.url || (result as any)?.fileUrl || (result as any)?.result?.webViewLink || '';
            const notificationText = `🔔 <b>Thông báo lưu trữ:</b>\nĐã xuất file biên bản và tự động lưu lên Google Drive thành công.\n- <b>Tên file:</b> ${fileName || 'document.pdf'}\n${fileLink ? `- <b>Đường dẫn:</b> ${fileLink}` : ''}`;
            
            await sendSystemNotification(notificationText);

            return res.status(200).json({ success: true, result });
        }

        if (type === 'telegram') {
            const { text } = req.body;
            if (!text) return res.status(400).json({ error: 'Missing text' });

            await sendSystemNotification(text);

            return res.status(200).json({ success: true });
        }

        return res.status(400).json({ error: 'Invalid type parameter' });
    } catch (error: any) {
        console.error(`[System Utils API Error] type=${type}:`, error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
