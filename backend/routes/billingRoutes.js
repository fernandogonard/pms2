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
  generateInvoice
} = require('../controllers/billingController');

// Bypass de autenticación en desarrollo para pruebas locales sin token
const devProtect = (req, res, next) => {
  if ((process.env.NODE_ENV || 'development') !== 'production' && !req.headers.authorization) {
    req.user = { id: 'dev-admin', userId: 'dev-admin', role: 'admin' };
    return next();
  }
  return protect(req, res, next);
};

// 📋 TIPOS DE HABITACIÓN Y PRECIOS
// GET /api/billing/room-types - Obtener tipos de habitación con precios
router.get('/room-types', devProtect, getRoomTypes);

// PUT /api/billing/room-types/:id - Actualizar precio de tipo de habitación (solo admin)
router.put('/room-types/:id', devProtect, authorize('admin'), updateRoomTypePrice);

// 💰 CÁLCULOS Y PRECIOS
// POST /api/billing/calculate - Calcular precio de reserva
router.post('/calculate', devProtect, calculateReservationPrice);

// 💳 PAGOS
// POST /api/billing/reservations/:id/payment - Procesar pago
router.post('/reservations/:id/payment', devProtect, authorize('admin', 'recepcionista'), processPayment);

// GET /api/billing/reservations/:id - Obtener información de facturación de reserva
router.get('/reservations/:id', devProtect, getReservationBilling);

// 🧾 FACTURAS
// POST /api/billing/reservations/:id/invoice - Generar factura
router.post('/reservations/:id/invoice', devProtect, authorize('admin', 'recepcionista'), generateInvoice);

// GET /api/billing/invoices/pending - Obtener facturas pendientes
router.get('/invoices/pending', devProtect, authorize('admin', 'recepcionista'), getPendingInvoices);

// 📊 REPORTES FINANCIEROS
// GET /api/billing/summary - Obtener resumen financiero
router.get('/summary', devProtect, authorize('admin'), getFinancialSummary);

module.exports = router;