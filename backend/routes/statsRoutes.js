// routes/statsRoutes.js
// Rutas para estadísticas del sistema

const express = require('express');
const router = express.Router();
const cors = require('cors');
const { protect } = require('../middlewares/authMiddleware');
const statsController = require('../controllers/statsController');

// Configurar CORS específico para estas rutas
const corsOptions = {
  origin: function(origin, callback) {
    callback(null, true); // Permitir cualquier origen para estadísticas
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With', 'Cache-Control'],
  methods: ['GET', 'OPTIONS'],
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// Aplicar CORS a nivel de router y manejar preflight OPTIONS
router.options('/rooms', cors(corsOptions));

// Ruta para obtener estadísticas de habitaciones
router.get('/rooms', cors(corsOptions), protect, statsController.getRoomStats);

module.exports = router;