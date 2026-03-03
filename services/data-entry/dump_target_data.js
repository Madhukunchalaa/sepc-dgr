const fs = require('fs');

const powerData = JSON.parse(fs.readFileSync('Power_arr.json', 'utf8'));
const waterData = JSON.parse(fs.readFileSync('Water_arr.json', 'utf8'));

const targetRowPower = 15;
const targetDateStr = powerData[targetRowPower][0];

console.log(`Target Date: ${targetDateStr}`);

function extractDataAndSave(data, targetDate, name) {
    let rowIndex = -1;
    for (let i = 0; i < data.length; i++) {
        if (data[i] && data[i][0] === targetDate) {
            rowIndex = i;
            break;
        }
    }

    if (rowIndex === -1) {
        console.log(`Date not found in ${name}`);
        return;
    }

    const row = data[rowIndex];
    const headers0 = data[0] || [];
    const headers1 = data[1] || [];
    const headers2 = data[2] || [];

    const obj = {};
    for (let j = 0; j < row.length; j++) {
        if (row[j] !== null && row[j] !== undefined && row[j] !== '') {
            let colName = headers2[j] || headers1[j] || headers0[j] || `Col_${j}`;
            // Clean colname replacing \r \n
            colName = colName.toString().replace(/[\r\n]+/g, ' ').trim();
            obj[`${j} - ${colName}`] = row[j];
        }
    }

    fs.writeFileSync(`Target_${name}.json`, JSON.stringify(obj, null, 2));
    console.log(`Saved Target_${name}.json for Row ${rowIndex}`);
}

extractDataAndSave(powerData, targetDateStr, 'Power');
extractDataAndSave(waterData, targetDateStr, 'Water');
