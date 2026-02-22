import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import productsHandler from './api/products.js';
import employeesHandler from './api/employees.js';
import transactionsHandler from './api/transactions.js';
import returnsHandler from './api/employee_returns.js';
import ordersHandler from './api/orders.js';
import districtStorekeepersHandler from './api/district_storekeepers.js';

dotenv.config();

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

app.listen(PORT, () => {
    console.log(`[Local API Server] Running on http://localhost:${PORT}`);
    console.log(`[Local API Server] Serving endpoints attached to Google Sheets.`);
});
