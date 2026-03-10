// test_taqa_engine.js
const { assembleDGR } = require('./services/dgr-compute/src/engines/dgr.engine');

async function test() {
    const taqaPlantId = '78920445-14de-4144-b736-8dc7a5849ca1';
    const targetDate = '2025-04-01';

    try {
        const report = await assembleDGR(taqaPlantId, targetDate);
        console.log('TAQA Report Header:', JSON.stringify(report.header, null, 2));

        const genSection = report.sections.find(s => s.title.includes('GENERATION'));
        console.log('Generation Section:', JSON.stringify(genSection.rows, null, 2));

        const fuelSection = report.sections.find(s => s.title.includes('FUEL'));
        console.log('Fuel Section:', JSON.stringify(fuelSection.rows, null, 2));

    } catch (err) {
        console.error('Test failed:', err);
    }
}

test();
