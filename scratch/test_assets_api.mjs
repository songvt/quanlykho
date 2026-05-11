import fetch from 'node-fetch';

const testPayload = {
    action: 'bulk_insert',
    payload: [{
        asset_code: 'TEST-001',
        asset_name: 'Test Laptop Dell',
        quantity: 1,
        status: 'Moi'
    }]
};

const res = await fetch('http://localhost:3001/api/assets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testPayload)
});

const body = await res.text();
console.log('Status:', res.status);
console.log('Response:', body);
