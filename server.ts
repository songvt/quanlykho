import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import compression from 'compression';

import productsHandler from './api_handlers/products.js';
import employeesHandler from './api_handlers/employees.js';
import transactionsHandler from './api_handlers/transactions.js';
import ordersHandler from './api_handlers/orders.js';
import assetsHandler from './api_handlers/assets.js';
import auditsHandler from './api_handlers/audits.js';
import settlementsHandler from './api_handlers/settlements.js';
import systemUtilsHandler from './api_handlers/system_utils.js';
import systemConfigHandler from './api_handlers/system_config.js';
import zaloHandler from './api_handlers/zalo.js';
import geminiHandler from './api_handlers/gemini.js';
import ocrHandler from './api_handlers/ocr.js';
import trinhkyHandler from './api_handlers/trinhky.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(compression());
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
app.all('/api/orders', createVercelHandler(ordersHandler));
app.all('/api/assets', createVercelHandler(assetsHandler));
app.all('/api/audits', createVercelHandler(auditsHandler));
app.all('/api/zalo', createVercelHandler(zaloHandler));
app.all('/api/gemini', createVercelHandler(geminiHandler));
app.all('/api/ocr', createVercelHandler(ocrHandler));
app.all('/api/trinhky', createVercelHandler(trinhkyHandler));
app.all('/api/system_config', createVercelHandler(systemConfigHandler));

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
app.all('/api/hr_profiles', (req, res) => {
    setQueryType(req, 'hr_profiles');
    return createVercelHandler(employeesHandler)(req, res);
});
app.all('/api/kpi_infractions', (req, res) => {
    setQueryType(req, 'kpi_infractions');
    return createVercelHandler(employeesHandler)(req, res);
});
app.all('/api/employee_returns', (req, res) => {
    setQueryType(req, 'employee_returns');
    return createVercelHandler(employeesHandler)(req, res);
});
app.all('/api/district_storekeepers', (req, res) => {
    setQueryType(req, 'district_storekeepers');
    return createVercelHandler(employeesHandler)(req, res);
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
