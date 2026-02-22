import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

export const getGoogleSheet = async () => {
    try {
        const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
        let privateKey = process.env.GOOGLE_PRIVATE_KEY;
        const sheetId = process.env.GOOGLE_SHEET_ID;

        if (!serviceAccountEmail || !privateKey || !sheetId) {
            console.error('Missing Google Sheets credentials in environment variables.');
            throw new Error('Server Configuration Error');
        }

        // Handle private key format from env var (replace literal \n with actual newlines)
        privateKey = privateKey.replace(/\\n/g, '\n');

        const serviceAccountAuth = new JWT({
            email: serviceAccountEmail,
            key: privateKey,
            scopes: [
                'https://www.googleapis.com/auth/spreadsheets',
            ],
        });

        const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);
        await doc.loadInfo();
        return doc;
    } catch (error) {
        console.error('Error initializing Google Sheets:', error);
        throw error;
    }
};

/**
 * Helper to get or create a sheet by title.
 * Important: Make sure the sheet titles match exactly what you pass here.
 */
export const getSheetByTitle = async (doc: GoogleSpreadsheet, title: string) => {
    let sheet = doc.sheetsByTitle[title];
    if (!sheet) {
        console.warn(`Sheet with title "${title}" not found.`);
        // Note: Creating sheets programmatically might need specific headers defined, 
        // so it's safer to require manual creation of the sheets first.
        throw new Error(`Sheet "${title}" not found. Please create it in the Google Sheet.`);
    }
    return sheet;
};
