const router = require('express').Router();
const ctrl = require('../controllers/anpara.controller');
const { authenticate, requirePlantAccess } = require('../middleware/auth.middleware');

router.get('/:plantId/:date',         authenticate, requirePlantAccess, ctrl.getEntry);
router.post('/:plantId/:date',        authenticate, requirePlantAccess, ctrl.upsertEntry);
router.post('/:plantId/:date/submit', authenticate, requirePlantAccess, ctrl.submitEntry);
router.post('/:plantId/:date/approve',authenticate, requirePlantAccess, ctrl.approveEntry);

module.exports = router;
