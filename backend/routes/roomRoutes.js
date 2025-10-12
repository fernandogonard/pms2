// routes/roomRoutes.js
// Rutas para gestión de habitaciones

const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const maintenanceController = require('../controllers/maintenanceController');
const { protect, authorize } = require('../middlewares/authMiddleware');
const { roomsLimiter, adminLimiter } = require('../config/rateLimiter');
const maintenanceMiddleware = require('../middlewares/maintenanceMiddleware');

// 🆕 Importar validaciones Joi
const { createValidationMiddleware, validateParams } = require('../services/validationService');

// 🆕 Solo admin puede crear, actualizar o eliminar habitaciones con validación Joi
router.post('/', 
  adminLimiter, 
  protect, 
  authorize('admin'), 
  createValidationMiddleware('room'), // 🔄 Validar datos de habitación
  roomController.createRoom
);
router.put('/:id', 
  adminLimiter, 
  protect, 
  authorize('admin'), 
  validateParams('mongoId'), // 🔄 Validar ID de MongoDB
  createValidationMiddleware('room'), // 🔄 Validar datos de habitación
  roomController.updateRoom
);
router.delete('/:id', 
  adminLimiter, 
  protect, 
  authorize('admin'), 
  validateParams('mongoId'), // 🔄 Validar ID de MongoDB
  roomController.deleteRoom
);

// Endpoint para consultar habitaciones disponibles por tipo y fechas
router.get('/available', roomsLimiter, protect, roomController.getAvailableRooms);

// Todos los roles pueden ver habitaciones y estado real
router.get('/', roomsLimiter, protect, roomController.getRooms); // requiere autenticación
router.get('/status', roomsLimiter, protect, roomController.getRoomsStatus); // requiere autenticación
router.get('/:id', 
  roomsLimiter, 
  protect, 
  validateParams('mongoId'), // 🔄 Validar ID de MongoDB
  roomController.getRoomById
);

// 🧹 GESTIÓN DE LIMPIEZA - Solo admin/recepcionista
router.get('/cleaning', roomsLimiter, protect, authorize('admin', 'recepcionista'), roomController.getRoomsInCleaning);
router.put('/:id/mark-clean', adminLimiter, protect, authorize('admin', 'recepcionista'), roomController.markRoomAsClean);
router.put('/mark-clean-bulk', adminLimiter, protect, authorize('admin', 'recepcionista'), roomController.markRoomsAsClean);

// 🔧 GESTIÓN DE MANTENIMIENTO - Solo admin
router.post('/:id/maintenance', adminLimiter, protect, authorize('admin'), maintenanceMiddleware.validateMaintenance, maintenanceController.startMaintenance);
router.put('/:id/maintenance/complete', adminLimiter, protect, authorize('admin'), maintenanceController.completeMaintenance);
router.get('/maintenance', roomsLimiter, protect, authorize('admin', 'recepcionista'), maintenanceController.getRoomsInMaintenance);
router.get('/:id/maintenance/history', roomsLimiter, protect, authorize('admin'), maintenanceController.getMaintenanceHistory);
router.get('/:id/maintenance/impact', roomsLimiter, protect, authorize('admin'), maintenanceController.checkMaintenanceImpact);

// 🔄 VALIDACIÓN DE ESTADOS
router.get('/:id/allowed-states', roomsLimiter, protect, authorize('admin', 'recepcionista'), roomController.getRoomAllowedStates);

module.exports = router;
