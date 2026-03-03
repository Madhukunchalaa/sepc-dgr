const fs = require('fs');

const powerData = JSON.parse(fs.readFileSync('Power_arr.json', 'utf8'));

// Find row 14 and 15
console.log("Row 14:");
const row14 = powerData[14];
for (let i = 0; i < 30; i++) {
    console.log(`Col ${i}: ${row14[i]}`);
}

console.log("\nRow 15:");
const row15 = powerData[15];
for (let i = 0; i < 30; i++) {
    console.log(`Col ${i}: ${row15[i]}`);
}
