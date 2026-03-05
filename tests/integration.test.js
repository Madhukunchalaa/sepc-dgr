const request = require('supertest');
const axios = require('axios');

const GATEWAY_URL = 'http://localhost:3000';

describe('DGR Platform Integration Tests', () => {
    let accessToken;
    let plantId;
    const testDate = '2026-03-05';

    // 1. Authentication Test
    test('Should login and receive an access token', async () => {
        const response = await request(GATEWAY_URL)
            .post('/api/auth/login')
            .send({
                email: 'admin@sepcpower.com',
                password: 'Admin@1234'
            });

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveProperty('accessToken');
        accessToken = response.body.data.accessToken;
    });

    // 2. Fetch Plants Test
    test('Should fetch the list of plants', async () => {
        const response = await request(GATEWAY_URL)
            .get('/api/plants')
            .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body.data.plants)).toBe(true);
        expect(response.body.data.plants.length).toBeGreaterThan(0);
        plantId = response.body.data.plants[0].id;
    });

    // 3. Data Entry - Power Status Test
    test('Should fetch submission status for a specific date', async () => {
        const response = await request(GATEWAY_URL)
            .get(`/api/data-entry/submission/${plantId}?date=${testDate}`)
            .set('Authorization', `Bearer ${accessToken}`);

        if (response.status === 500) console.error('Status 500 error:', response.body);
        expect(response.status).toBe(200);
        expect(response.body.data).toHaveProperty('modules');

        // Verify Ash and DSM are in the list (from our previous fix)
        const modules = response.body.data.modules.map(m => m.module);
        expect(modules).toContain('ash');
        expect(modules).toContain('dsm');
    });

    // 4. Data Entry - Save Power Data
    test('Should save power data as draft', async () => {
        const response = await request(GATEWAY_URL)
            .post('/api/data-entry/power')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                plantId: plantId,
                entryDate: testDate,
                meterReadings: {
                    GEN_MAIN: 1000,
                    GT_EXP_MAIN: 900,
                    GT_IMP_MAIN: 10,
                    UT_A_IMP: 5,
                    UT_B_IMP: 5,
                    BR_IMP: 2
                },
                hoursOnGrid: 24,
                status: 'draft'
            });

        if (response.status !== 201 && response.status !== 200) {
            console.error('Save power error:', response.status, response.body);
        }
        expect([200, 201]).toContain(response.status);
    });

    // 5. DGR Compute - Fetch calculated data
    test('Should fetch calculated DGR data', async () => {
        const response = await request(GATEWAY_URL)
            .get(`/api/dgr/${plantId}/${testDate}`)
            .set('Authorization', `Bearer ${accessToken}`);

        if (response.status === 500) console.error('Compute 500 error:', response.body);
        expect(response.status).toBe(200);
        expect(response.body.data).toHaveProperty('header');
        expect(response.body.data.meta.targetDate).toBe(testDate);
    });

    // 6. Reports - Excel Generation (Check headers)
    test('Should return Excel report headers', async () => {
        const response = await request(GATEWAY_URL)
            .get(`/api/reports/dgr/excel/${plantId}/${testDate}`)
            .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toContain('spreadsheetml');
    });
});
