const express = require('express');
const router = express.Router();
const controller = require('../controllers/dsm.controller');
router.get('/:plantId/:date', controller.getDsmEntry);
router.post('/upsert', controller.upsertDsmEntry);
module.exports = router;
