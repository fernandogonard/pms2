// routes/reportRoutes.js
const express = require('express');
const reportController = require('../controllers/reportController');
const router = express.Router();

// Rutas de reportes
router.get('/occupancy', reportController.getOccupancyReport);
// Ruta para reporte de ingresos
router.get('/revenue', reportController.revenueReport);

module.exports = router;
