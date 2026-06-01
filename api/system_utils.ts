import { VercelRequest, VercelResponse } from '@vercel/node';
import { uploadToGoogleDrive } from './_utils/googleDrive.js';

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
            return res.status(200).json({ success: true, result });
        }

        if (type === 'telegram') {
            const { text } = req.body;
            if (!text) return res.status(400).json({ error: 'Missing text' });

            const token = process.env.TELEGRAM_BOT_TOKEN;
            const chatId = process.env.TELEGRAM_CHAT_ID;
            if (!token || !chatId) {
                return res.status(500).json({ error: 'Telegram configuration missing' });
            }
            const url = `https://api.telegram.org/bot${token}/sendMessage`;

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
            });

            const data = await response.json();
            return res.status(200).json(data);
        }

        return res.status(400).json({ error: 'Invalid type parameter' });
    } catch (error: any) {
        console.error(`[System Utils API Error] type=${type}:`, error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
