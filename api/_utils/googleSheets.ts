import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

let cachedDoc: GoogleSpreadsheet | null = null;
let lastLoadTime = 0;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 phút cache

export const getGoogleSheet = async () => {
    try {
        const now = Date.now();
        if (cachedDoc && (now - lastLoadTime) < CACHE_DURATION_MS) {
            return cachedDoc;
        }

        const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
        let privateKey = process.env.GOOGLE_PRIVATE_KEY;
        const sheetId = process.env.GOOGLE_SHEET_ID;

        if (!serviceAccountEmail || !privateKey || !sheetId) {
            const missingInfo = [
                !serviceAccountEmail ? 'Email' : '',
                !privateKey ? 'PrivateKey' : '',
                !sheetId ? 'SheetID' : ''
            ].filter(Boolean).join(', ');
            console.error(`Missing Google Sheets credentials: ${missingInfo}`);
            throw new Error(`Server Configuration Error: Missing ${missingInfo}`);
        }

        // Handle private key format from env var
        if (privateKey.startsWith('"')) {
            privateKey = privateKey.slice(1);
        }
        if (privateKey.endsWith('"')) {
            privateKey = privateKey.slice(0, -1);
        }
        privateKey = privateKey.replace(/\\n/g, '\n');
        privateKey = privateKey.trim(); // Trim any trailing/leading whitespaces/newlines

        const serviceAccountAuth = new JWT({
            email: serviceAccountEmail,
            key: privateKey,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);
        await doc.loadInfo();

        cachedDoc = doc;
        lastLoadTime = now;
        return doc;
    } catch (error) {
        // Reset cache on error so next call retries fresh
        cachedDoc = null;
        lastLoadTime = 0;
        console.error('Error initializing Google Sheets:', error);
        throw error;
    }
};

/**
 * Helper to get a sheet by title. Throws if not found.
 */
export const getSheetByTitle = async (doc: GoogleSpreadsheet, title: string) => {
    const sheet = doc.sheetsByTitle[title];
    if (!sheet) {
        console.warn(`Sheet with title "${title}" not found.`);
        throw new Error(`Sheet "${title}" not found. Please create it in the Google Sheet.`);
    }
    return sheet;
};
