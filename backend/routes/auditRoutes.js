// routes/auditRoutes.js
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/authMiddleware');
const { getAuditLogs, getActionTypes, getAuditStats } = require('../controllers/auditController');

router.get('/',        protect, authorize('admin'), getAuditLogs);
router.get('/actions', protect, authorize('admin'), getActionTypes);
router.get('/stats',   protect, authorize('admin'), getAuditStats);

module.exports = router;
