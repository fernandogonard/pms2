// routes/statsRoutes.js
// Rutas para estadísticas del sistema

const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const statsController = require('../controllers/statsController');

// El CORS global de app.js ya cubre estas rutas — sin override local para evitar conflictos
router.get('/rooms', protect, statsController.getRoomStats);

module.exports = router;