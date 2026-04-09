import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ error: 'Missing text' });

        const token = process.env.TELEGRAM_BOT_TOKEN || '6446138704:AAG7eFdMA7cWOubGcbard0zsM-fD2_wlsTk';
        const chatId = process.env.TELEGRAM_CHAT_ID || '-4080685922';
        const url = `https://api.telegram.org/bot${token}/sendMessage`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
        });

        const data = await response.json();
        return res.status(200).json(data);
    } catch (error: any) {
        console.error('Telegram API Error:', error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
