// routes/userRoutes.js
// Rutas para gestión de usuarios (solo admin)

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect, authorize } = require('../middlewares/authMiddleware');

// 🆕 Importar validaciones Joi
const { createValidationMiddleware, validateParams } = require('../services/validationService');


// 🆕 Solo admin y recepcionista pueden ver usuarios
router.get('/', protect, authorize('admin', 'recepcionista'), userController.getUsers);
router.get('/:id', 
  protect, 
  authorize('admin', 'recepcionista'), 
  validateParams('mongoId'), // 🔄 Validar ID de MongoDB
  userController.getUserById
);

// 🆕 Solo admin puede crear, editar o eliminar con validaciones Joi
router.post('/', 
  protect, 
  authorize('admin'), 
  createValidationMiddleware('user'), // 🔄 Validar datos de usuario
  userController.createUser
);
router.put('/:id', 
  protect, 
  authorize('admin'), 
  validateParams('mongoId'), // 🔄 Validar ID de MongoDB
  createValidationMiddleware('user'), // 🔄 Validar datos de usuario
  userController.updateUser
);
router.delete('/:id', 
  protect, 
  authorize('admin'), 
  validateParams('mongoId'), // 🔄 Validar ID de MongoDB
  userController.deleteUser
);

module.exports = router;
