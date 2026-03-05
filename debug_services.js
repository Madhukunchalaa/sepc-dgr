const axios = require('axios');

async function debug() {
    console.log('--- Debugging Services Directly ---');
    try {
        const res3003 = await axios.get('http://127.0.0.1:3003/api/data-entry/submission/1a2b3c4d', {
            validateStatus: false
        });
        console.log('Port 3003 (singular):', res3003.status);
        console.log('Modules:', res3003.data.data?.modules?.map(m => m.module));
    } catch (e) {
        console.log('Port 3003 error:', e.message);
    }

    try {
        const res3004 = await axios.get('http://127.0.0.1:3004/api/dgr/1a2b3c4d/2026-03-05', {
            validateStatus: false
        });
        console.log('Port 3004:', res3004.status);
        if (res3004.status === 500) console.log('Error data:', res3004.data);
    } catch (e) {
        console.log('Port 3004 error:', e.message);
    }
}

debug();
