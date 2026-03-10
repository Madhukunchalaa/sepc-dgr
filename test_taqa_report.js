require('dotenv').config({ path: './.env' });
const { assembleTaqaDGR } = require('./services/dgr-compute/src/engines/taqa.engine');

async function testReport() {
    const plant = {
        id: '78920445-14de-4144-b736-8dc7a5849ca1',
        short_name: 'TAQA'
    };
    const date = '2026-03-02';

    try {
        console.log(`--- Testing TAQA DGR Assembly for ${date} ---`);
        const report = await assembleTaqaDGR(plant, date);
        console.log('Report Header:', report.header);
        console.log('Section count:', report.sections?.length);

        // Check some values
        const powerSec = report.sections?.find(s => s.title.includes('POWER'));
        console.log('Power Section Rows:', powerSec?.rows?.length);
        if (powerSec) {
            powerSec.rows.forEach(r => {
                console.log(`  ${r.particulars}: Daily=${r.daily}, MTD=${r.mtd}, YTD=${r.ytd}`);
            });
        }

    } catch (e) {
        console.error('❌ ERROR:', e.message);
        console.error(e.stack);
    } finally {
        process.exit(0);
    }
}
testReport();
