const { assembleDGR } = require('./services/dgr-compute/src/engines/dgr.engine.js');
async function test() {
    try {
        const dgr = await assembleDGR('36cd41f9-b150-46da-a778-a838679a343f', '2026-01-02');
        console.log("SUCCESS:", Object.keys(dgr));
        console.log("ASH:", dgr.ash);
        process.exit(0);
    } catch (e) {
        console.error("DIED WITH ERROR:", e);
        process.exit(1);
    }
}
test();
