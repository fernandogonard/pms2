// routes/relocationRoutes.js
// Rutas para la relocalización de huéspedes

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/authMiddleware');
const relocationController = require('../controllers/relocationController');

// Ruta para relocalizar un huésped
// POST /api/rooms/:id/relocate
router.post('/rooms/:id/relocate', protect, authorize('admin', 'manager'), relocationController.relocateGuest);

module.exports = router;