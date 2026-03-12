const { Client } = require('pg');
const fs = require('fs');

async function run() {
    const c = new Client({
        connectionString: 'postgresql://postgres:PbMsdsxhFwcPpdoscBrbYEkgDPQjbTLW@interchange.proxy.rlwy.net:47169/railway',
        ssl: { rejectUnauthorized: false }
    });

    try {
        await c.connect();
        const taqa = await c.query(`SELECT id FROM plants WHERE short_name LIKE 'TAQA%' LIMIT 1`);
        if (taqa.rows.length === 0) throw new Error("TAQA plant not found");

        const pid = taqa.rows[0].id;
        const res = await c.query('SELECT * FROM taqa_daily_input WHERE plant_id=$1 AND entry_date=$2', [pid, '2026-03-10']);

        if (res.rows.length === 0) {
            fs.writeFileSync('taqa_dump.json', JSON.stringify({ error: "No data for 2026-03-10" }));
        } else {
            const row = res.rows[0];
            const populated = Object.entries(row)
                .filter(([k, v]) => v !== null && v !== '')
                .reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {});

            const empty = Object.entries(row)
                .filter(([k, v]) => v === null || v === '')
                .map(([k]) => k);

            fs.writeFileSync('taqa_dump.json', JSON.stringify({
                date: row.entry_date,
                status: row.status,
                populatedCount: Object.keys(populated).length,
                emptyCount: empty.length,
                populatedFields: populated
            }, null, 2));
        }
    } catch (err) {
        fs.writeFileSync('taqa_dump.json', JSON.stringify({ error: err.message }));
    } finally {
        await c.end();
    }
}

run();
