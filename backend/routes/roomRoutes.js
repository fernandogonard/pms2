// routes/roomRoutes.js
// Rutas para gestión de habitaciones

const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const maintenanceController = require('../controllers/maintenanceController');
const { protect, authorize } = require('../middlewares/authMiddleware');
const { roomsLimiter, adminLimiter } = require('../config/rateLimiter');
const maintenanceMiddleware = require('../middlewares/maintenanceMiddleware');

const { createValidationMiddleware, validateParams } = require('../services/validationService');

/**
 * @swagger
 * /api/rooms:
 *   get:
 *     tags: [Rooms]
 *     summary: Listar todas las habitaciones
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [disponible, ocupada, limpieza, mantenimiento] }
 *         description: Filtrar por estado
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [doble, triple, cuadruple, suite] }
 *         description: Filtrar por tipo
 *     responses:
 *       200:
 *         description: Lista de habitaciones
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Room' }
 *       401: { description: No autorizado }
 *   post:
 *     tags: [Rooms]
 *     summary: Crear habitación (solo admin)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Room' }
 *     responses:
 *       201: { description: Habitación creada }
 *       400: { description: Datos inválidos }
 *       403: { description: Sin permisos }
 */
router.post('/', 
  adminLimiter, 
  protect, 
  authorize('admin'), 
  createValidationMiddleware('room'), // 🔄 Validar datos de habitación
  roomController.createRoom
);
router.put('/mark-clean-bulk', adminLimiter, protect, authorize('admin', 'recepcionista'), roomController.markRoomsAsClean);
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

// Endpoint público: tipos de habitación disponibles (sin auth — usado por el motor de reservas)
router.get('/types', roomsLimiter, roomController.getRoomTypes);

// Endpoint para consultar habitaciones disponibles por tipo y fechas
router.get('/available', roomsLimiter, protect, roomController.getAvailableRooms);

// Todos los roles pueden ver habitaciones y estado real
router.get('/', roomsLimiter, protect, roomController.getRooms); // requiere autenticación
router.get('/status', roomsLimiter, protect, roomController.getRoomsStatus); // requiere autenticación
// 🔒 Rutas estáticas ANTES de /:id para evitar conflictos de Express
router.get('/cleaning', roomsLimiter, protect, authorize('admin', 'recepcionista'), roomController.getRoomsInCleaning);
router.get('/maintenance', roomsLimiter, protect, authorize('admin', 'recepcionista'), maintenanceController.getRoomsInMaintenance);
router.get('/:id', 
  roomsLimiter, 
  protect, 
  validateParams('mongoId'), // 🔄 Validar ID de MongoDB
  roomController.getRoomById
);

// 🧹 GESTIÓN DE LIMPIEZA - Solo admin/recepcionista
router.put('/:id/mark-clean', adminLimiter, protect, authorize('admin', 'recepcionista'), roomController.markRoomAsClean);
router.put('/:id/complete-task', adminLimiter, protect, authorize('admin', 'recepcionista'), roomController.completeHousekeeping);

// 🔧 GESTIÓN DE MANTENIMIENTO - Solo admin
router.post('/:id/maintenance', adminLimiter, protect, authorize('admin'), maintenanceMiddleware.validateMaintenance, maintenanceController.startMaintenance);
router.put('/:id/maintenance/complete', adminLimiter, protect, authorize('admin'), maintenanceController.completeMaintenance);
router.get('/:id/maintenance/history', roomsLimiter, protect, authorize('admin'), maintenanceController.getMaintenanceHistory);
router.get('/:id/maintenance/impact', roomsLimiter, protect, authorize('admin'), maintenanceController.checkMaintenanceImpact);

// 🔄 VALIDACIÓN DE ESTADOS
router.get('/:id/allowed-states', roomsLimiter, protect, authorize('admin', 'recepcionista'), roomController.getRoomAllowedStates);

module.exports = router;
