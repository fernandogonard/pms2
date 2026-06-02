// routes/paymentRoutes.js
// Rutas para pagos con Mercado Pago

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/authMiddleware');
const { createPreference, handleWebhook, getPaymentStatus } = require('../controllers/paymentController');

// POST /api/payments/webhook — SIN JWT (Mercado Pago no envía tokens)
// IMPORTANTE: Debe estar ANTES de cualquier middleware de auth
// rawBody ya capturado por express.json() en app.js (req.rawBody disponible)
router.post('/webhook', handleWebhook);

// POST /api/payments/preference — Requiere autenticación (admin o recepcionista)
router.post('/preference', protect, authorize('admin', 'recepcionista'), createPreference);

// GET /api/payments/status/:paymentId — Consultar estado de un pago
router.get('/status/:paymentId', protect, authorize('admin', 'recepcionista'), getPaymentStatus);

module.exports = router;
