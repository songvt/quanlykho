import { VercelRequest, VercelResponse } from '@vercel/node';
import { createWeeklyBackup } from './_utils/weeklyBackup.js';
import { getCronAuthorizationError } from './_utils/httpSecurity.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    const authorizationError = getCronAuthorizationError(req);
    if (authorizationError) return res.status(authorizationError.status).json({ error: authorizationError.error });
    try {
        const backup = await createWeeklyBackup();
        return res.status(201).json({ message: 'Weekly backup created', backup });
    } catch (error: any) {
        console.error('[Weekly Backup] Failed:', error);
        return res.status(500).json({ error: error.message || 'Weekly backup failed' });
    }
}
