import fetch from 'node-fetch';

async function testEndpoint(name, endpoint) {
    const start = Date.now();
    try {
        const res = await fetch(`http://localhost:3001/api/${endpoint}`);
        const data = await res.json();
        const duration = Date.now() - start;
        console.log(`${name}: ${duration}ms (Items: ${Array.isArray(data) ? data.length : 'N/A'})`);
    } catch (e) {
        console.error(`${name} ERROR:`, e.message);
    }
}

async function run() {
    console.log('Testing local API performance after optimization...');
    await Promise.all([
        testEndpoint('Products', 'products'),
        testEndpoint('Transactions', 'transactions'),
        testEndpoint('Orders', 'orders'),
        testEndpoint('Employees', 'employees')
    ]);
}

run();
