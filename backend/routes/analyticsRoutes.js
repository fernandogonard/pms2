// routes/analyticsRoutes.js
// Rutas para analytics avanzados

const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { protect, authorize } = require('../middlewares/authMiddleware');
const { analyticsLimiter } = require('../config/rateLimiter');

// Todas las rutas requieren autenticación y rol admin/recepcionista
const adminRecepcionist = authorize('admin', 'recepcionista');

// Endpoints de analytics
router.get('/occupancy', analyticsLimiter, protect, adminRecepcionist, analyticsController.getOccupancyTrend);
router.get('/revenue', analyticsLimiter, protect, adminRecepcionist, analyticsController.getRevenueData);
router.get('/room-types', analyticsLimiter, protect, adminRecepcionist, analyticsController.getRoomTypeDistribution);
router.get('/checkin-trend', analyticsLimiter, protect, adminRecepcionist, analyticsController.getCheckinTrend);
router.get('/kpis', analyticsLimiter, protect, adminRecepcionist, analyticsController.getKPIs);

module.exports = router;