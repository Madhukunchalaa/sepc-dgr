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

module.exports = router;
