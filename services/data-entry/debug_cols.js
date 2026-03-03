const fs = require('fs');
const powerData = JSON.parse(fs.readFileSync('Power_arr.json', 'utf8'));

const row = powerData[22]; // April 15 

console.log("Analyzing April 15th: " + row[0]);
for (let i = 35; i < 100; i++) {
    if (typeof row[i] === 'number') {
        console.log(`Col ${i}: ${row[i]}`);
    }
}
