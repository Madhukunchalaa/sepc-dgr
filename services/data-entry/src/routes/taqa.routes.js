// services/data-entry/src/routes/taqa.routes.js
const router = require('express').Router();
const ctrl = require('../controllers/taqa.controller');
const { authenticate, requirePlantAccess } = require('../middleware/auth.middleware');

// GET raw entry for a given plant/date
router.get('/:plantId/:date', authenticate, requirePlantAccess, ctrl.getEntry);

// POST — save/update raw Ops + Chem input fields (draft)
router.post('/:plantId/:date', authenticate, requirePlantAccess, ctrl.upsertEntry);

// POST — calculate derived DGR metrics from raw input and submit
router.post('/:plantId/:date/submit', authenticate, requirePlantAccess, ctrl.submitEntry);

// POST — approve: marks all linked DGR table records as approved
router.post('/:plantId/:date/approve', authenticate, requirePlantAccess, ctrl.approveEntry);

module.exports = router;
