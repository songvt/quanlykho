import { Request, Response } from 'express';
import { JWT } from 'google-auth-library';
import { google } from 'googleapis';

export default async function uploadInventoryDonViHandler(req: Request, res: Response) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { payload } = req.body; // array of rows (each row is an array of columns A-I)
        
        if (!payload || !Array.isArray(payload)) {
            return res.status(400).json({ error: 'Payload must be an array of rows' });
        }

        const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
        let privateKey = process.env.GOOGLE_PRIVATE_KEY;
        const targetSheetId = '1a283D_F9P5qpDyEOE3HRBEESFtvfQMxqUGH5ntZqrjo';
        const targetSheetName = 'Q12-BCCS-DON_VI';

        if (!serviceAccountEmail || !privateKey) {
            return res.status(500).json({ error: 'Missing Google Service Account credentials in environment variables.' });
        }

        // Handle private key formatting
        if (privateKey.startsWith('"')) privateKey = privateKey.slice(1);
        if (privateKey.endsWith('"')) privateKey = privateKey.slice(0, -1);
        privateKey = privateKey.replace(/\\n/g, '\n').trim();

        const auth = new JWT({
            email: serviceAccountEmail,
            key: privateKey,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const sheets = google.sheets({ version: 'v4', auth });

        // 1. Xóa trắng vùng dữ liệu từ A2:I (hàng 2 trở xuống)
        // Clear range
        const clearRange = `'${targetSheetName}'!A2:I`;
        await sheets.spreadsheets.values.clear({
            spreadsheetId: targetSheetId,
            range: clearRange,
        });

        // 2. Dán dữ liệu mới vào từ A2
        if (payload.length > 0) {
            const updateRange = `'${targetSheetName}'!A2`;
            await sheets.spreadsheets.values.update({
                spreadsheetId: targetSheetId,
                range: updateRange,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: payload,
                },
            });
        }

        return res.json({ success: true, message: `Successfully imported ${payload.length} rows.` });
    } catch (error: any) {
        console.error('[uploadInventoryNVHandler] Error:', error);
        const errMsg = error.response?.data?.error?.message || error.message || 'Lỗi server';
        return res.status(500).json({ error: errMsg });
    }
}
