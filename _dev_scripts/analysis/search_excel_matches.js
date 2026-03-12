const fs = require('fs');
const content = fs.readFileSync('ops_input_jan2.txt', 'utf8');

const targets = ["4724.902", "5041.880", "4811.795", "515", "5485"];

targets.forEach(t => {
    const lines = content.split('\n');
    const matches = lines.filter(l => l.includes(t));
    console.log(`\nMatches for ${t}:`);
    if (matches.length > 0) {
        matches.forEach(m => console.log(m));
    } else {
        console.log("No match found.");
    }
});
