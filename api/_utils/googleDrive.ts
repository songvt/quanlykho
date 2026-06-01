import { google } from 'googleapis';
import { Readable } from 'stream';

export const uploadToGoogleDrive = async (
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    folderId: string
) => {
    try {
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
