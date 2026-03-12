const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const services = ['auth', 'plant-config', 'data-entry', 'dgr-compute', 'report-export'];

services.forEach(service => {
  console.log(`--- Checking Service: ${service} ---`);
  try {
    const indexPath = path.join(__dirname, 'services', service, 'src', 'index.js');
    if (fs.existsSync(indexPath)) {
      const content = fs.readFileSync(indexPath, 'utf8');
      const dotenvLine = content.split('\n').find(line => line.includes('dotenv'));
      console.log(`Dotenv configuration: ${dotenvLine ? dotenvLine.trim() : 'NOT FOUND'}`);
      
      // Try to run a tiny node script in that service's context to see if it can read .env
      const checkCmd = `node -e "require('dotenv').config({ path: '../../.env' }); const secret = process.env.JWT_SECRET; console.log('JWT_SECRET: length=' + (secret ? secret.length : 'N/A') + ', firstChar=' + (secret ? secret.charCodeAt(0) : 'N/A') + ', lastChar=' + (secret ? secret.charCodeAt(secret.length-1) : 'N/A'))"`;
      const output = execSync(checkCmd, { cwd: path.join(__dirname, 'services', service) }).toString();
      console.log(`Environment check: ${output.trim()}`);
    } else {
      console.log(`Index file not found at ${indexPath}`);
    }
  } catch (e) {
    console.error(`Error checking ${service}: ${e.message}`);
  }
});
