// routes/cleaningRoutes.js
// Rutas para gestión de limpieza de habitaciones

const express = require('express');
const router = express.Router();
const cleaningController = require('../controllers/cleaningController');
const CheckoutService = require('../services/CheckoutService');
const { protect, authorize } = require('../middlewares/authMiddleware');
const { logger } = require('../services/loggerService');

// ─── ENDPOINTS DE CHECKOUT HOY ───────────────────────────────────────────────

// GET /api/cleaning/checkouts/today - Obtener habitaciones con checkout hoy
router.get('/checkouts/today', 
  protect, 
  authorize('admin', 'recepcionista', 'limpieza'), 
  async (req, res) => {
    try {
      const checkouts = await CheckoutService.getCheckoutsToday();
      res.json({
        success: true,
        data: checkouts,
        count: checkouts.length
      });
    } catch (error) {
      logger.error('Error obteniendo checkouts hoy:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// GET /api/cleaning/pending - Obtener todas las limpiezas pendientes
router.get('/pending', 
  protect, 
  authorize('admin', 'recepcionista', 'limpieza'), 
  async (req, res) => {
    try {
      const { status } = req.query; // 'todos', 'asignada', 'en_progreso', 'completada'
      const cleanings = await CheckoutService.getPendingCleanings(status);
      res.json({
        success: true,
        data: cleanings,
        count: cleanings.length
      });
    } catch (error) {
      logger.error('Error obteniendo limpiezas pendientes:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// ─── ENDPOINTS DE ASIGNACIÓN Y PROGRESO ───────────────────────────────────────

// POST /api/cleaning/:roomId/assign - Asignar limpieza a una habitación
router.post('/:roomId/assign', 
  protect, 
  authorize('admin', 'recepcionista'), 
  async (req, res) => {
    try {
      const { roomId } = req.params;
      const { assignedTo, housekeepingType = 'limpieza_checkout' } = req.body;

      if (!assignedTo) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere el nombre/ID del limpiador'
        });
      }

      const updated = await CheckoutService.assignCleaning(
        roomId,
        assignedTo,
        housekeepingType
      );

      res.json({
        success: true,
        data: updated,
        message: 'Limpieza asignada correctamente'
      });

    } catch (error) {
      logger.error('Error asignando limpieza:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// PATCH /api/cleaning/:roomId/start - Marcar como en progreso
router.patch('/:roomId/start', 
  protect, 
  authorize('admin', 'recepcionista', 'limpieza'), 
  async (req, res) => {
    try {
      const { roomId } = req.params;
      const updated = await CheckoutService.startCleaning(roomId);

      res.json({
        success: true,
        data: updated,
        message: 'Limpieza iniciada'
      });

    } catch (error) {
      logger.error('Error iniciando limpieza:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// PATCH /api/cleaning/:roomId/complete - Marcar como completada
router.patch('/:roomId/complete', 
  protect, 
  authorize('admin', 'recepcionista', 'limpieza'), 
  async (req, res) => {
    try {
      const { roomId } = req.params;
      const { notes = '' } = req.body;
      const updated = await CheckoutService.completeCleaning(roomId, notes);

      res.json({
        success: true,
        data: updated,
        message: 'Limpieza completada - Habitación disponible'
      });

    } catch (error) {
      logger.error('Error completando limpieza:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// DELETE /api/cleaning/:roomId/cancel - Cancelar limpieza asignada
router.delete('/:roomId/cancel', 
  protect, 
  authorize('admin', 'recepcionista'), 
  async (req, res) => {
    try {
      const { roomId } = req.params;
      const { reason = '' } = req.body;
      const updated = await CheckoutService.cancelCleaning(roomId, reason);

      res.json({
        success: true,
        data: updated,
        message: 'Limpieza cancelada'
      });

    } catch (error) {
      logger.error('Error cancelando limpieza:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// ─── ENDPOINTS EXISTENTES (COMPATIBILIDAD) ───────────────────────────────────

// GET /api/cleaning - Obtener habitaciones en estado de limpieza
router.get('/', protect, authorize('admin', 'recepcionista', 'limpieza'), cleaningController.getRoomsInCleaning);

// GET /api/cleaning/stats - Estadísticas de limpieza
router.get('/stats', protect, authorize('admin', 'recepcionista', 'limpieza'), cleaningController.getCleaningStats);

// PUT /api/cleaning/:id/clean - Marcar una habitación como limpia
router.put('/:id/clean', protect, authorize('admin', 'recepcionista', 'limpieza'), cleaningController.markRoomAsClean);

// POST /api/cleaning/clean-bulk - Marcar múltiples habitaciones como limpias
router.post('/clean-bulk', protect, authorize('admin', 'recepcionista', 'limpieza'), cleaningController.markRoomsAsClean);

module.exports = router;