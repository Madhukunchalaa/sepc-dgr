// services/data-entry/src/routes/scada.routes.js
const router = require('express').Router();
const ctrl   = require('../controllers/scada.controller');
const { authenticate, requirePlantAccess } = require('../middleware/auth.middleware');

router.get('/mappings/:plantId',     authenticate, requirePlantAccess, ctrl.getMappings);
router.post('/mappings/:plantId',    authenticate, requirePlantAccess, ctrl.saveMappings);
router.post('/upload/:plantId',      authenticate, requirePlantAccess, ctrl.uploadAndPreview);
router.post('/confirm/:plantId',     authenticate, requirePlantAccess, ctrl.confirmImport);

module.exports = router;
