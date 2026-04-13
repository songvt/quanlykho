import { VercelRequest, VercelResponse } from '@vercel/node';
import { uploadToGoogleDrive } from './utils/googleDrive.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const allowedMethods = ['POST'];
    if (!allowedMethods.includes(req.method || '')) {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { fileName, mimeType, fileData } = req.body;

        if (!fileData) {
            return res.status(400).json({ error: 'No file data provided' });
        }

        // fileData is expected to be a Base64 encoded string
        const buffer = Buffer.from(fileData, 'base64');
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '1eAusIt6z7bcunlAPFe99ipMh1ZB2zCWE';
        
        const result = await uploadToGoogleDrive(
            buffer,
            fileName || `document_${Date.now()}.pdf`,
            mimeType || 'application/pdf',
            folderId
        );
        res.status(200).json({ success: true, result });
    } catch (error: any) {
        console.error('Drive Upload Error:', error);
        res.status(500).json({ error: 'Failed to upload to Google Drive', details: error?.message });
    }
}
