// routes/reservationRoutes.js
// Rutas para gestión de reservas

const express = require('express');
const router = express.Router();
const reservationController = require('../controllers/reservationController');
const reservationOptimized = require('../controllers/reservationOptimized');
const { protect, authorize } = require('../middlewares/authMiddleware');
const { reservationLimiter, adminLimiter } = require('../config/rateLimiter');

// 🆕 Importar validaciones Joi
const { createValidationMiddleware, validateParams, validateQuery } = require('../services/validationService');

// 🆕 Crear reserva con validación Joi (pública o autenticada)
// Si hay token, se asigna usuario; si no, reserva pública
router.post('/', 
  reservationLimiter, 
  createValidationMiddleware('reservation'), // 🔄 Validar datos de reserva
  reservationController.createReservation
);

// 🆕 Obtener todas las reservas con paginación (admin y recepcionista)
router.get('/', 
  reservationLimiter, 
  protect, 
  authorize('admin', 'recepcionista'), 
  validateQuery('pagination'), // 🔄 Validar parámetros de paginación
  reservationController.getReservations
);

// Obtener reservas propias (cliente)
router.get('/mine', reservationLimiter, protect, authorize('cliente'), reservationController.getMyReservations);

// 🆕 Actualizar reserva con validación Joi (solo admin/recepcionista o propietario)
router.put('/:id', 
  reservationLimiter, 
  protect, 
  validateParams('mongoId'), // 🔄 Validar ID de MongoDB
  createValidationMiddleware('reservation'), // 🔄 Validar datos de reserva
  reservationController.updateReservation
);

// Asignar habitación concreta (solo admin/recepcionista)
router.put('/:id/assign-room', adminLimiter, protect, authorize('admin', 'recepcionista'), reservationController.assignRoomToReservation);

// 🔧 Desasignar habitaciones de una reserva (solo admin/recepcionista)
router.put('/:id/unassign-rooms', adminLimiter, protect, authorize('admin', 'recepcionista'), reservationController.unassignRoomsFromReservation);

// 🚪 Realizar check-out de una reserva (solo admin/recepcionista)
router.put('/:id/checkout', adminLimiter, protect, authorize('admin', 'recepcionista'), reservationController.checkoutReservation);

// Eliminar reserva (solo admin/recepcionista o propietario)
router.delete('/:id', reservationLimiter, protect, reservationController.deleteReservation);

// Limpiar reservas fantasma (solo admin)
router.post('/cleanup-ghost', adminLimiter, protect, authorize('admin'), reservationController.cleanupGhostReservations);

// Check-in con asignación automática (solo admin/recepcionista)
router.post('/:id/checkin', adminLimiter, protect, authorize('admin', 'recepcionista'), reservationController.checkinReservation);

// Check-out con liberación de habitaciones (solo admin/recepcionista)
router.post('/:id/checkout', adminLimiter, protect, authorize('admin', 'recepcionista'), reservationController.checkoutReservation);

// � Obtener reservas con checkout pendiente (que deberían haber terminado pero siguen activas)
router.get('/pending-checkouts', reservationLimiter, protect, authorize('admin', 'recepcionista'), reservationController.getPendingCheckouts);

// �🚀 ENDPOINTS OPTIMIZADOS PARA CIENTOS DE RESERVAS
// Obtener reservas con paginación, filtros y búsqueda avanzada
router.get('/optimized', reservationLimiter, protect, authorize('admin', 'recepcionista'), reservationOptimized.getReservationsOptimized);

// Estadísticas rápidas para dashboard
router.get('/stats', reservationLimiter, protect, authorize('admin', 'recepcionista'), reservationOptimized.getReservationStats);

module.exports = router;
