// routes/clientRoutes.js
const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
const { protect, authorize } = require('../middlewares/authMiddleware');

// 🆕 Importar validaciones Joi
const { createValidationMiddleware, validateParams } = require('../services/validationService');

// 🆕 Solo admin puede gestionar clientes con validaciones Joi
router.post('/', 
  protect, 
  authorize('admin'), 
  createValidationMiddleware('client'), // 🔄 Validar datos de cliente
  clientController.createClient
);
router.get('/', protect, authorize('admin'), clientController.listClients);
router.get('/:id', 
  protect, 
  authorize('admin'), 
  validateParams('mongoId'), // 🔄 Validar ID de MongoDB
  clientController.getClient
);
router.put('/:id', 
  protect, 
  authorize('admin'), 
  validateParams('mongoId'), // 🔄 Validar ID de MongoDB
  createValidationMiddleware('client'), // 🔄 Validar datos de cliente
  clientController.updateClient
);
router.delete('/:id', 
  protect, 
  authorize('admin'), 
  validateParams('mongoId'), // 🔄 Validar ID de MongoDB
  clientController.deleteClient
);

module.exports = router;
