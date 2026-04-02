// services/data-entry/src/routes/mis.routes.js
const express = require('express');
const router = express.Router();
const misController = require('../controllers/mis.controller');
const { authenticate, requirePlantAccess } = require('../middleware/auth.middleware');

router.use(authenticate);

// Incident Report
router.get('/incident/:plantId/:date', requirePlantAccess, misController.getIncident);
router.post('/incident', misController.upsertIncident);

// RCA Report
router.get('/rca/:plantId/:date', requirePlantAccess, misController.getRca);
router.post('/rca', misController.upsertRca);

// Unit Trip Report
router.get('/trip/:plantId/:date', requirePlantAccess, misController.getTrip);
router.post('/trip', misController.upsertTrip);

// BTG Report
router.get('/btg/:plantId/:date', requirePlantAccess, misController.getBtg);
router.post('/btg', misController.upsertBtg);

// Load Record Statement
router.get('/load-record/:plantId/:date', requirePlantAccess, misController.getLoadRecord);
router.post('/load-record', misController.upsertLoadRecord);

// MOC Report
router.get('/moc/:plantId/:mocNo', requirePlantAccess, misController.getMoc);
router.post('/moc', misController.upsertMoc);

module.exports = router;
