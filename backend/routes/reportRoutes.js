// routes/reportRoutes.js
const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { protect, authorize } = require('../middlewares/authMiddleware');

// Solo admin puede descargar reportes
router.get('/occupancy', protect, authorize('admin'), reportController.occupancyReport);

module.exports = router;
