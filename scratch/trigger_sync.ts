import 'dotenv/config';
import handler from '../api/cron-sync.js';

async function trigger() {
    const mockReq = { method: 'GET' } as any;
    const mockRes = {
        status: (code: number) => {
            console.log('Status:', code);
            return mockRes;
        },
        json: (data: any) => {
            console.log('JSON:', JSON.stringify(data, null, 2));
            return mockRes;
        }
    } as any;

    console.log('Triggering sync...');
    await handler(mockReq, mockRes);
}

trigger();
