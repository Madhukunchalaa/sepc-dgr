const express = require('express');
const router = express.Router();
const schedController = require('../controllers/scheduling.controller');
const { authenticate, authorize, requirePlantAccess } = require('../middleware/auth.middleware');

// Require authentication, plant access and operator/admin roles
router.use(authenticate, requirePlantAccess, authorize('plant_operator', 'plant_admin', 'it_admin'));

router.get('/:plantId/:date', schedController.getEntry);
router.post('/', schedController.upsertEntry);
router.post('/submit', schedController.submitEntry);
router.post('/approve', authorize('plant_admin', 'it_admin'), schedController.approveEntry);
router.post('/unlock', authorize('plant_admin', 'it_admin'), schedController.unlockEntry);

module.exports = router;
