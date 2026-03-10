const axios = require('axios');
async function checkPlants() {
    try {
        const r = await axios.get('http://localhost:3002/api/plants');
        console.log('Plants from API:', JSON.stringify(r.data, null, 2));
    } catch (e) {
        console.error('Error fetching plants:', e.message);
    }
}
checkPlants();
