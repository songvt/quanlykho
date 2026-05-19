import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import productsHandler from './api/products.js';
import employeesHandler from './api/employees.js';
import transactionsHandler from './api/transactions.js';
import returnsHandler from './api/employee_returns.js';
import ordersHandler from './api/orders.js';
import districtStorekeepersHandler from './api/district_storekeepers.js';
import assetsHandler from './api/assets.js';
import auditsHandler from './api/audits.js';
import settlementsHandler from './api/settlements.js';
import systemUtilsHandler from './api/system_utils.js';
import hrProfilesHandler from './api/hr_profiles.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Function to cast Express req/res to Vercel/Next.js signature
const createVercelHandler = (handler: any) => {
    return async (req: express.Request, res: express.Response) => {
        try {
            await handler(req, res);
        } catch (error) {
            console.error('Unhandled Server Error:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    };
};

// Mount the API endpoints explicitly
app.all('/api/products', createVercelHandler(productsHandler));
app.all('/api/employees', createVercelHandler(employeesHandler));
app.all('/api/transactions', createVercelHandler(transactionsHandler));
app.all('/api/employee_returns', createVercelHandler(returnsHandler));
app.all('/api/orders', createVercelHandler(ordersHandler));
app.all('/api/district_storekeepers', createVercelHandler(districtStorekeepersHandler));
app.all('/api/assets', createVercelHandler(assetsHandler));
app.all('/api/audits', createVercelHandler(auditsHandler));
app.all('/api/hr_profiles', createVercelHandler(hrProfilesHandler));

// Helper to safely override Express prototype query getter
const setQueryType = (req: express.Request, type: string) => {
    Object.defineProperty(req, 'query', {
        value: { ...req.query, type },
        writable: true,
        configurable: true,
        enumerable: true
    });
};

// Forwarded routes mimicking Vercel's rewrites in vercel.json
app.all('/api/settlement_history', (req, res) => {
    setQueryType(req, 'history');
    return createVercelHandler(settlementsHandler)(req, res);
});
app.all('/api/settlement_inventory', (req, res) => {
    setQueryType(req, 'inventory');
    return createVercelHandler(settlementsHandler)(req, res);
});
app.all('/api/settlement_outbound', (req, res) => {
    setQueryType(req, 'outbound');
    return createVercelHandler(settlementsHandler)(req, res);
});
app.all('/api/stats', (req, res) => {
    setQueryType(req, 'stats');
    return createVercelHandler(settlementsHandler)(req, res);
});
app.all('/api/asset_handovers', (req, res) => {
    setQueryType(req, 'handovers');
    return createVercelHandler(assetsHandler)(req, res);
});
app.all('/api/asset_logs', (req, res) => {
    setQueryType(req, 'logs');
    return createVercelHandler(assetsHandler)(req, res);
});
app.all('/api/qr_logs', (req, res) => {
    setQueryType(req, 'qr');
    return createVercelHandler(auditsHandler)(req, res);
});
app.all('/api/telegram', (req, res) => {
    setQueryType(req, 'telegram');
    return createVercelHandler(systemUtilsHandler)(req, res);
});
app.all('/api/drive_upload', (req, res) => {
    setQueryType(req, 'drive_upload');
    return createVercelHandler(systemUtilsHandler)(req, res);
});

app.get('/api/diagnose', (req, res) => {
    const key = process.env.SUPABASE_ANON_KEY || '';
    return res.json({
        SUPABASE_URL: process.env.SUPABASE_URL,
        VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
        ANON_KEY_LENGTH: key.length,
        ANON_KEY_PREVIEW: key ? `${key.substring(0, 10)}...${key.substring(key.length - 10)}` : 'empty',
        ENV_KEYS: Object.keys(process.env).filter(k => k.includes('SUPABASE') || k.includes('SHEET'))
    });
});

app.listen(PORT, () => {
    console.log(`[Local API Server] Running on http://localhost:${PORT}`);
    console.log(`[Local API Server] Serving endpoints attached to Google Sheets.`);
});
