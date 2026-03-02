const express = require('express');
const router = express.Router();
const availController = require('../controllers/availability.controller');
const { authenticate, authorize, requirePlantAccess } = require('../middleware/auth.middleware');

// Require authentication, plant access and operator/admin roles
router.use(authenticate, requirePlantAccess, authorize('plant_operator', 'plant_admin', 'it_admin'));

router.get('/:plantId/:date', availController.getEntry);
router.post('/', availController.upsertEntry);
router.post('/submit', availController.submitEntry);
router.post('/approve', authorize('plant_admin', 'it_admin'), availController.approveEntry);

module.exports = router;
