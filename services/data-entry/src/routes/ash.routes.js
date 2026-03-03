const express = require('express');
const router = express.Router();
const controller = require('../controllers/ash.controller');
router.get('/:plantId/:date', controller.getAshEntry);
router.post('/upsert', controller.upsertAshEntry);
module.exports = router;
