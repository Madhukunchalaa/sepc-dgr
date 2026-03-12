const http = require('http');

async function request(options, postData) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        data: data ? JSON.parse(data) : null
                    });
                } catch (e) {
                    resolve({ statusCode: res.statusCode, headers: res.headers, data });
                }
            });
        });
        req.on('error', reject);
        if (postData) req.write(JSON.stringify(postData));
        req.end();
    });
}

async function run() {
    console.log('--- Phase 1: Login ---');
    const loginRes = await request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, { email: 'admin@sepcpower.com', password: 'admin123' });

    if (loginRes.statusCode !== 200) {
        console.error('Login failed:', loginRes.statusCode, loginRes.data);
        return;
    }
    const token = loginRes.data.data.accessToken;
    console.log('Login success. Token obtained.');

    const authHeader = { 'Authorization': `Bearer ${token}` };

    console.log('\n--- Phase 2: Test TTPP (SEPC) Power Entry ---');
    const ttppId = '36cd41f9-b150-46da-a778-a838679a343f';
    const ttppDate = '2026-03-10';
    const ttppRes = await request({
        hostname: 'localhost',
        port: 3000,
        path: `/api/data-entry/power/${ttppId}/${ttppDate}`,
        method: 'GET',
        headers: authHeader
    });
    console.log(`TTPP (${ttppDate}):`, ttppRes.statusCode, ttppRes.data?.success ? 'FOUND' : 'NOT_FOUND/ERROR');
    if (ttppRes.statusCode !== 200) console.log('Response:', ttppRes.data);

    console.log('\n--- Phase 3: Test TAQA Entry ---');
    const taqaId = '78920445-14de-4144-b736-8dc7a5849ca1';
    const taqaDate = '2025-03-31'; // Earlier audit showed data for this date
    const taqaRes = await request({
        hostname: 'localhost',
        port: 3000,
        path: `/api/data-entry/taqa/${taqaId}/${taqaDate}`,
        method: 'GET',
        headers: authHeader
    });
    console.log(`TAQA (${taqaDate}):`, taqaRes.statusCode, taqaRes.data?.success ? 'FOUND' : 'NOT_FOUND/ERROR');

    console.log('\n--- Phase 4: Test TAQA DGR Report ---');
    const dgrRes = await request({
        hostname: 'localhost',
        port: 3000,
        path: `/api/dgr/${taqaId}/${taqaDate}`,
        method: 'GET',
        headers: authHeader
    });
    console.log(`TAQA DGR (${taqaDate}):`, dgrRes.statusCode, dgrRes.data?.success ? 'SUCCESS' : 'FAILURE');

    console.log('\n--- Phase 5: Test TAQA Persistence (Save & Load) ---');
    const testDate = '2026-06-01';
    const testData = {
        gen_main_meter: 1234.56,
        day_highlights: 'Test persistence fix - text should remain.'
    };

    console.log('Saving mock entry...');
    const saveRes = await request({
        hostname: 'localhost',
        port: 3000,
        path: `/api/data-entry/taqa/${taqaId}/${testDate}`,
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' }
    }, testData);
    console.log('Save result:', saveRes.statusCode, saveRes.data?.message);

    console.log('Loading saved entry...');
    const loadRes = await request({
        hostname: 'localhost',
        port: 3000,
        path: `/api/data-entry/taqa/${taqaId}/${testDate}`,
        method: 'GET',
        headers: authHeader
    });
    console.log('Load result:', loadRes.statusCode);
    if (loadRes.statusCode === 200) {
        const loaded = loadRes.data.data || loadRes.data;
        console.log('Loaded highlights:', loaded.day_highlights);
        const match = loaded.day_highlights === testData.day_highlights;
        console.log('Persistence verification:', match ? 'PASSED' : 'FAILED');
    }
}

run().catch(console.error);
