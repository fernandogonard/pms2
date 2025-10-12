// routes/cleaningRoutes.js
// Rutas para gestión de limpieza de habitaciones

const express = require('express');
const router = express.Router();
const cleaningController = require('../controllers/cleaningController');
const { protect, authorize } = require('../middlewares/authMiddleware');

// GET /api/cleaning - Obtener habitaciones en estado de limpieza
router.get('/', protect, authorize('admin', 'recepcionista', 'limpieza'), cleaningController.getRoomsInCleaning);

// GET /api/cleaning/stats - Estadísticas de limpieza
router.get('/stats', protect, authorize('admin', 'recepcionista', 'limpieza'), cleaningController.getCleaningStats);

// PUT /api/cleaning/:id/clean - Marcar una habitación como limpia
router.put('/:id/clean', protect, authorize('admin', 'recepcionista', 'limpieza'), cleaningController.markRoomAsClean);

// POST /api/cleaning/clean-bulk - Marcar múltiples habitaciones como limpias
router.post('/clean-bulk', protect, authorize('admin', 'recepcionista', 'limpieza'), cleaningController.markRoomsAsClean);

module.exports = router;