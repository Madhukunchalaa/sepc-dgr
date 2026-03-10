const axios = require('axios');

async function test() {
    try {
        const GATEWAY = 'https://sepc-dgr-production.up.railway.app';
        console.log('--- Testing Gateway ---');

        // Use a known user or skip auth if possible (unlikely)
        // Actually, I can check /health
        const health = await axios.get(`${GATEWAY}/health`);
        console.log('Health:', health.data);

        // I'll try to login if I have credentials from .env or previous turno
    } catch (e) {
        console.error('Test failed:', e.message);
        if (e.response) console.error('Response:', e.response.status, e.response.data);
    }
}
test();
