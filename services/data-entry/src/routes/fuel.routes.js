const router = require('express').Router();
const ctrl   = require('../controllers/fuel.controller');
const { authenticate, requirePlantAccess } = require('../middleware/auth.middleware');

router.get('/:plantId/:date', authenticate, requirePlantAccess, ctrl.getEntry);
router.post('/',              authenticate, requirePlantAccess, ctrl.upsertEntry);
router.post('/submit',        authenticate, requirePlantAccess, ctrl.submitEntry);
router.post('/approve',       authenticate, requirePlantAccess, ctrl.approveEntry);

module.exports = router;
