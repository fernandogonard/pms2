// controllers/userController.js
// Controlador para gestión de usuarios (solo admin)

const User = require('../models/User');
const bcrypt = require('bcryptjs');

// 🆕 Importar nuevo sistema de logging Winston
const { logger } = require('../services/loggerService');

// Obtener todos los usuarios
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener usuarios.', error });
  }
};

// Obtener usuario por ID
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener usuario.', error });
  }
};

// 🆕 Crear usuario con logging avanzado (admin)
exports.createUser = async (req, res) => {
  const startTime = Date.now();
  try {
    const { name, email, password, role } = req.body;

    // 📝 Log del intento de creación
    logger.audit.userAction(
      'CREATE_USER_ATTEMPT',
      req.user.id,
      'user',
      null,
      { targetEmail: email, targetRole: role, ip: req.ip }
    );

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'Todos los campos son obligatorios.' });
    }
    const exists = await User.findOne({ email });
    if (exists) {
      // 📝 Log del intento de crear usuario duplicado
      logger.security.suspiciousActivity(
        'duplicate_user_creation',
        { email, existingUserId: exists._id },
        req.user.id,
        req.ip
      );
      return res.status(409).json({ message: 'El email ya está registrado.' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword, role });
    await user.save();

    // 📝 Log de éxito
    const duration = Date.now() - startTime;
    logger.audit.userAction(
      'CREATE_USER_SUCCESS',
      req.user.id,
      'user',
      user._id.toString(),
      { targetEmail: email, targetRole: role, duration }
    );

    logger.audit.dataChange('CREATE', 'users', user._id.toString(), 
      { name, email, role }, req.user.id);

    logger.performance.requestTime(req.method, req.originalUrl, duration, 201, req.user.id);

    res.status(201).json({ message: 'Usuario creado correctamente.' });
  } catch (error) {
    // 📝 Log de error
    const duration = Date.now() - startTime;
    logger.error('Error al crear usuario', error, {
      adminId: req.user.id,
      targetEmail: req.body.email,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      duration
    });

    logger.performance.requestTime(req.method, req.originalUrl, duration, 500, req.user.id);

    res.status(500).json({ message: 'Error al crear usuario.', error });
  }
};

// Actualizar usuario (admin)
exports.updateUser = async (req, res) => {
  try {
    const { name, email, role } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { name, email, role },
      { new: true, runValidators: true, context: 'query' }
    ).select('-password');
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar usuario.', error });
  }
};

// 🆕 Eliminar usuario con logging avanzado (admin)
exports.deleteUser = async (req, res) => {
  const startTime = Date.now();
  try {
    const userId = req.params.id;

    // 📝 Log del intento de eliminación (acción crítica)
    logger.audit.adminAction(
      'DELETE_USER_ATTEMPT',
      req.user.id,
      userId,
      { ip: req.ip, userAgent: req.get('User-Agent') }
    );

    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    // 📝 Log de éxito (acción crítica completada)
    const duration = Date.now() - startTime;
    logger.audit.adminAction(
      'DELETE_USER_SUCCESS',
      req.user.id,
      userId,
      { 
        deletedUser: { email: user.email, role: user.role },
        duration
      }
    );

    logger.audit.dataChange('DELETE', 'users', userId, 
      { email: user.email, role: user.role }, req.user.id);

    logger.performance.requestTime(req.method, req.originalUrl, duration, 200, req.user.id);

    res.json({ message: 'Usuario eliminado.' });
  } catch (error) {
    // 📝 Log de error
    const duration = Date.now() - startTime;
    logger.error('Error al eliminar usuario', error, {
      adminId: req.user.id,
      targetUserId: req.params.id,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      duration
    });

    logger.performance.requestTime(req.method, req.originalUrl, duration, 500, req.user.id);

    res.status(500).json({ message: 'Error al eliminar usuario.', error });
  }
};
