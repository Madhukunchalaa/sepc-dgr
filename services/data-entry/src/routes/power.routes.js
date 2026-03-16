// services/data-entry/src/routes/power.routes.js
const router = require('express').Router();
const ctrl = require('../controllers/power.controller');
const { authenticate, requirePlantAccess } = require('../middleware/auth.middleware');

router.get('/:plantId/:date', authenticate, requirePlantAccess, ctrl.getEntry);
router.get('/:plantId/history', authenticate, requirePlantAccess, ctrl.getHistory);
router.post('/', authenticate, requirePlantAccess, ctrl.upsertEntry);
router.post('/submit', authenticate, requirePlantAccess, ctrl.submitEntry);
router.post('/approve', authenticate, requirePlantAccess, ctrl.approveEntry);

module.exports = router;
