const express = require('express');
const router = express.Router();
const opsController = require('../controllers/operations.controller');
const { authenticate, authorize, requirePlantAccess } = require('../middleware/auth.middleware');

// Require authentication, plant access and operator/admin roles
router.use(authenticate, requirePlantAccess, authorize('plant_operator', 'plant_admin', 'it_admin'));

router.get('/:plantId/:date', opsController.getEntry);
router.post('/', opsController.upsertEntry);
router.post('/submit', opsController.submitEntry);
router.post('/approve', authorize('plant_admin', 'it_admin'), opsController.approveEntry);

module.exports = router;
