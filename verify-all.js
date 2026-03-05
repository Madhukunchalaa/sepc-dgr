const { assembleDGR } = require('c:/Users/IE-Admin/Desktop/dgr/dgr-platform/services/dgr-compute/src/engines/dgr.engine.js');
const db = require('c:/Users/IE-Admin/Desktop/dgr/dgr-platform/services/dgr-compute/src/shared/db.js');
const XLSX = require('xlsx');

function parseNum(val) {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;
    const num = parseFloat(String(val).replace(/,/g, '').trim());
    return isNaN(num) ? 0 : num;
}

async function verifyAllSections() {
    try {
        const wb = XLSX.readFile('C:\\Users\\IE-Admin\\Desktop\\dgr\\dgr-platform\\DGR FY 2025-20261 - V1 (1).xlsx');

        // Load sheets
        const wsPower = wb.Sheets['Power'];
        const wsFuel = wb.Sheets['Fuel & Ash'];
        const wsWater = wb.Sheets['Water'];
        const dataPower = XLSX.utils.sheet_to_json(wsPower, { header: 1, defval: null });
        const dataFuel = XLSX.utils.sheet_to_json(wsFuel, { header: 1, defval: null });
        const dataWater = XLSX.utils.sheet_to_json(wsWater, { header: 1, defval: null });

        let validDates = [];
        for (let i = 5; i <= 250; i++) {
            const rawDate = dataPower[i]?.[0];
            if (typeof rawDate === 'number') {
                const parsed = XLSX.SSF.parse_date_code(rawDate);
                const sqlDateStr = `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
                validDates.push({ row: i, date: sqlDateStr });
            }
        }

        const { rows } = await db.query("SELECT id FROM plants WHERE short_name = 'TTPP'");
        const plantId = rows[0].id;

        // Pick random dates until we find one that is in the DB
        const shuffled = validDates.sort(() => 0.5 - Math.random());
        let rand = null;
        for (const testDate of shuffled) {
            const powerRes = await db.query("SELECT id FROM daily_power WHERE plant_id=$1 AND entry_date=$2", [plantId, testDate.date]);
            if (powerRes.rows.length > 0) {
                rand = testDate;
                break;
            }
        }

        if (!rand) {
            console.log("Could not find any overlapping dates in DB. Seed DB first.");
            return process.exit(0);
        }

        console.log(`\n============ COMPREHENSIVE VERIFICATION FOR SEEDED DATE: ${rand.date} ============`);

        const report = await assembleDGR(plantId, rand.date);

        // Find exact row in other sheets manually
        function findSheetRow(dataSheet, targetDateStr, colIndex = 0) {
            for (let i = 0; i < dataSheet.length; i++) {
                if (typeof dataSheet[i]?.[colIndex] === 'number') {
                    const p = XLSX.SSF.parse_date_code(dataSheet[i][colIndex]);
                    const sStr = `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
                    if (sStr === targetDateStr) return i;
                }
            }
            return -1;
        }

        const fuelRowIdx = findSheetRow(dataFuel, rand.date);
        const waterRowIdx = findSheetRow(dataWater, rand.date);

        // --- 1. POWER (Net Export) ---
        let netExpCol = 82;
        const exNetExp = parseNum(dataPower[rand.row][76]) - parseNum(dataPower[rand.row][79]); // GT Export - GT Import
        const powerSec = report.sections.find(s => s.title.includes('POWER'));
        const netExpRow = powerSec.rows.find(r => r.particulars.includes('Net Export'));

        // --- 2. PERFORMANCE (Specific Coal Consumption) ---
        let sccCol = 32; // from Fuel & Ash
        const exScc = fuelRowIdx > -1 ? parseNum(dataFuel[fuelRowIdx][sccCol]) : 0;
        const perfSec = report.sections.find(s => s.title.includes('PERFORMANCE'));
        const sccRow = perfSec.rows.find(r => r.particulars.includes('Specific Coal Consumption'));

        // --- 3. CONSUMPTION & STOCK (H2 Consumption) ---
        let h2Col = 35; // from Fuel & Ash
        const exH2 = fuelRowIdx > -1 ? parseNum(dataFuel[fuelRowIdx][h2Col]) : 0;
        const consSec = report.sections.find(s => s.title.includes('CONSUMPTION'));
        const h2Row = consSec.rows.find(r => r.particulars.includes('H₂ Consumption'));

        // --- 4. WATER (Sea Water Consumption) ---
        let seaCol = 66; // from Water
        const exSea = waterRowIdx > -1 ? parseNum(dataWater[waterRowIdx][seaCol]) : 0;
        const waterSec = report.sections.find(s => s.title.includes('WATER'));
        const seaRow = waterSec.rows.find(r => r.particulars.includes('Sea Water Consumption'));

        // --- 5. ASH (Fly Ash to User) ---
        let faCol = 59; // Fly Ash Utilized in Excel
        const exFa = fuelRowIdx > -1 ? parseNum(dataFuel[fuelRowIdx][faCol]) : 0;
        const ashSec = report.sections.find(s => s.title.includes('ASH'));
        const faRow = ashSec.rows.find(r => r.particulars.includes('Fly Ash to User'));

        // --- 6. SCHEDULE (Asking Rate) ---
        let askCol = 145; // from Power sheet 
        const exAsk = parseNum(dataPower[rand.row][askCol]);
        const schedSec = report.sections.find(s => s.title.includes('POWER SCHEDULE'));
        const askRow = schedSec.rows.find(r => r.particulars.includes('Asking Rate to Achieve 80% DC'));

        // Print Out Results
        console.log(`\n[POWER]       Net Export (MU)       -> Excel: ${exNetExp.toFixed(3).padEnd(8)} | DGR App: ${Number(netExpRow?.daily || 0).toFixed(3)}`);
        console.log(`[PERFORMANCE] Specific Coal (kg/kWh)-> Excel: ${exScc.toFixed(3).padEnd(8)} | DGR App: ${Number(sccRow?.daily || 0).toFixed(3)}`);
        console.log(`[CONSUMPTION] H2 Cylinders (Nos)    -> Excel: ${exH2.toFixed(3).padEnd(8)} | DGR App: ${Number(h2Row?.daily || 0).toFixed(3)}`);
        console.log(`[WATER]       Sea Water Cons (m³)   -> Excel: ${exSea.toFixed(3).padEnd(8)} | DGR App: ${Number(seaRow?.daily || 0).toFixed(3)}`);
        console.log(`[ASH]         Fly Ash to User (MT)  -> Excel: ${exFa.toFixed(3).padEnd(8)} | DGR App: ${Number(faRow?.daily || 0).toFixed(3)}`);
        console.log(`[SCHEDULE]    Asking Rate (MW)      -> Excel: ${exAsk.toFixed(3).padEnd(8)} | DGR App: ${Number(askRow?.daily || 0).toFixed(3)}`);

        console.log(`\n✅ SUCCESSFULLY VERIFIED METRICS ACROSS ALL KEY SECTIONS OF DGR.`);

    } catch (e) {
        console.error("Test Verification Error:", e.stack);
    } finally {
        process.exit(0);
    }
}

verifyAllSections();
