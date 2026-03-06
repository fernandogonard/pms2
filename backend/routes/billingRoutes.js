// routes/billingRoutes.js
// Rutas para gestión de facturación y pagos

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/authMiddleware');
const {
  getRoomTypes,
  updateRoomTypePrice,
  calculateReservationPrice,
  processPayment,
  getReservationBilling,
  getFinancialSummary,
  getPendingInvoices,
  generateInvoice,
  addCharge
} = require('../controllers/billingController');

// 📋 TIPOS DE HABITACIÓN Y PRECIOS
// GET /api/billing/room-types - Obtener tipos de habitación con precios
router.get('/room-types', protect, getRoomTypes);

// PUT /api/billing/room-types/:id - Actualizar precio de tipo de habitación (solo admin)
router.put('/room-types/:id', protect, authorize('admin'), updateRoomTypePrice);

// 💰 CÁLCULOS Y PRECIOS
// POST /api/billing/calculate - Calcular precio de reserva
router.post('/calculate', protect, calculateReservationPrice);

// 💳 PAGOS
// POST /api/billing/reservations/:id/payment - Procesar pago
router.post('/reservations/:id/payment', protect, authorize('admin', 'recepcionista'), processPayment);

// POST /api/billing/reservations/:id/charge - Agregar cargo extra (minibar, lavanderia, etc.)
router.post('/reservations/:id/charge', protect, authorize('admin', 'recepcionista'), addCharge);

// GET /api/billing/reservations/:id - Obtener información de facturación de reserva
router.get('/reservations/:id', protect, getReservationBilling);

// 🧾 FACTURAS
// POST /api/billing/reservations/:id/invoice - Generar factura
router.post('/reservations/:id/invoice', protect, authorize('admin', 'recepcionista'), generateInvoice);

// GET /api/billing/invoices/pending - Obtener facturas pendientes
router.get('/invoices/pending', protect, authorize('admin', 'recepcionista'), getPendingInvoices);

// 📊 REPORTES FINANCIEROS
// GET /api/billing/summary - Obtener resumen financiero
router.get('/summary', protect, authorize('admin'), getFinancialSummary);

module.exports = router;