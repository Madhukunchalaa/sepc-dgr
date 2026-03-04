const express = require('express');
const app = express();

app.get('/api/plants', (req, res) => res.send('MATCHED /api/plants'));
app.use((req, res) => res.status(404).send('404 Not Found'));

app.listen(3015, () => {
    fetch('http://localhost:3015/api/plants/')
        .then(async r => {
            const text = await r.text();
            console.log('GET /api/plants/ =>', r.status, text);
            process.exit(0);
        });
});
