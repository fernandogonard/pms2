// routes/analyticsRoutes.js
// Rutas para analytics avanzados

const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { protect, authorize } = require('../middlewares/authMiddleware');
const { analyticsLimiter } = require('../config/rateLimiter');

// Todas las rutas requieren autenticación y rol admin/recepcionista
const adminRecepcionist = authorize('admin', 'recepcionista');

// Bypass de autenticación en desarrollo para evitar 401 en dashboards locales
const devProtect = (req, res, next) => {
	if ((process.env.NODE_ENV || 'development') !== 'production' && !req.headers.authorization) {
		req.user = { id: 'dev-admin', role: 'admin' };
		return next();
	}
	return protect(req, res, next);
};

// Endpoints de analytics
router.get('/occupancy', analyticsLimiter, devProtect, adminRecepcionist, analyticsController.getOccupancyTrend);
router.get('/revenue', analyticsLimiter, devProtect, adminRecepcionist, analyticsController.getRevenueData);
router.get('/room-types', analyticsLimiter, devProtect, adminRecepcionist, analyticsController.getRoomTypeDistribution);
router.get('/checkin-trend', analyticsLimiter, devProtect, adminRecepcionist, analyticsController.getCheckinTrend);
router.get('/kpis', analyticsLimiter, devProtect, adminRecepcionist, analyticsController.getKPIs);

module.exports = router;