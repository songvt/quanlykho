import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import fs from 'fs';
import path from 'path';

// Load ENV correctly by splitting only at the first '='
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
    const index = line.indexOf('=');
    if (index !== -1) {
        const key = line.substring(0, index).trim();
        let value = line.substring(index + 1).trim();
        env[key] = value;
    }
});

const getGoogleSheet = async () => {
    const serviceAccountEmail = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    let privateKey = env.GOOGLE_PRIVATE_KEY;
    const sheetId = env.GOOGLE_SHEET_ID;

    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\n/g, '\n');

    const serviceAccountAuth = new JWT({
        email: serviceAccountEmail,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);
    await doc.loadInfo();
    return doc;
};

async function checkSheets() {
    try {
        console.log('Connecting to Google Sheet...');
        const doc = await getGoogleSheet();
        console.log(`Connected to Google Spreadsheet: "${doc.title}"`);
        console.log('--- List of Sheets (Tabs) ---');
        for (const [title, sheet] of Object.entries(doc.sheetsByTitle)) {
            console.log(`- Tab Name: "${title}", Row Count: ${sheet.rowCount}, Sheet ID: ${sheet.sheetId}`);
            if (sheet.headerValues && sheet.headerValues.length > 0) {
                console.log(`  Headers: [${sheet.headerValues.join(', ')}]`);
            } else {
                console.log('  No headers found.');
            }
        }
    } catch (err) {
        console.error('Error checking sheets:', err);
    }
}

checkSheets();
