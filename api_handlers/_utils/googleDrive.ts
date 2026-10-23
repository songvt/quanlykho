import { google } from 'googleapis';
import { Readable } from 'stream';

const APPS_SCRIPT_TIMEOUT_MS = 40_000;

export const uploadToGoogleDrive = async (
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    folderId: string
) => {
    try {
        const appsScriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
        if (appsScriptUrl) {
            console.log('Uploading via Google Apps Script Web App...');
            const base64Data = fileBuffer.toString('base64');
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), APPS_SCRIPT_TIMEOUT_MS);
            let response: Response;
            try {
                response = await fetch(appsScriptUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    signal: controller.signal,
                    body: JSON.stringify({
                        fileName,
                        mimeType,
                        fileData: base64Data,
                        folderId
                    })
                });
            } catch (error: any) {
                if (error?.name === 'AbortError') {
                    throw new Error('Google Drive phản hồi quá chậm. Ảnh chưa được lưu, vui lòng thử lại khi kết nối ổn định hơn.');
                }
                throw error;
            } finally {
                clearTimeout(timeout);
            }
            if (!response.ok) {
                throw new Error(`Apps Script HTTP error! status: ${response.status}`);
            }
            const result = await response.json() as any;
            if (!result.success) {
                throw new Error(result.error || 'Unknown Apps Script error');
            }
            return result;
        }

        const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
        let privateKey = process.env.GOOGLE_PRIVATE_KEY;

        if (!serviceAccountEmail || !privateKey) {
            throw new Error('Missing Google Drive credentials');
        }

        privateKey = privateKey.replace(/\\n/g, '\n');

        const auth = new google.auth.JWT({
            email: serviceAccountEmail,
            key: privateKey,
            scopes: ['https://www.googleapis.com/auth/drive.file'],
        });

        const drive = google.drive({ version: 'v3', auth });

        const stream = new Readable();
        stream.push(fileBuffer);
        stream.push(null);

        const fileMetadata = {
            name: fileName,
            parents: [folderId],
        };

        const media = {
            mimeType: mimeType,
            body: stream,
        };

        const response = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id, webViewLink, webContentLink',
            supportsAllDrives: true,
        });

        return response.data;
    } catch (error) {
        console.error('Error uploading to Google Drive:', error);
        throw error;
    }
};
