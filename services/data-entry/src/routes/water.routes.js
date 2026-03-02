const express = require('express');
const router = express.Router();
const waterController = require('../controllers/water.controller');
const { authenticate, authorize, requirePlantAccess } = require('../middleware/auth.middleware');

// All water routes require a valid JWT + plant access + operator/admin role
router.use(authenticate, requirePlantAccess, authorize('plant_operator', 'plant_admin', 'it_admin'));

router.get('/:plantId/:date', waterController.getEntry);
router.post('/', waterController.upsertEntry);
router.post('/submit', waterController.submitEntry);
router.post('/approve', authorize('plant_admin', 'it_admin'), waterController.approveEntry);

module.exports = router;
