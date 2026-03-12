const fs = require('fs');

const file = '24cal_logic_full.json';
let txt = fs.readFileSync(file, 'utf16le');

// Remove BOM if present
if (txt.charCodeAt(0) === 0xFEFF) {
    txt = txt.slice(1);
}

const data = JSON.parse(txt);

data.forEach(item => {
    if (item.label) {
        console.log(`Row ${item.row}: ${item.label}`);
        console.log(`  Formula: ${item.formula}`);
    }
});
