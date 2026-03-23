// services/data-entry/src/routes/sepc-excel.routes.js
const router = require('express').Router();
const ctrl   = require('../controllers/sepc-excel.controller');
const { authenticate, requirePlantAccess } = require('../middleware/auth.middleware');

// POST /api/data-entry/sepc-excel/upload/:plantId
// Body: multipart/form-data — dgrFile (Excel), entryDate (YYYY-MM-DD), previewOnly (optional)
router.post('/upload/:plantId', authenticate, requirePlantAccess, ctrl.uploadAndSave);

module.exports = router;
