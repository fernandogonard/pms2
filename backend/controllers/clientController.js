// controllers/clientController.js
const Client = require('../models/Client');
const Reservation = require('../models/Reservation');

// 🆕 Importar nuevo sistema de logging Winston
const { logger } = require('../services/loggerService');

// Crear cliente
exports.createClient = async (req, res) => {
  const startTime = Date.now();
  try {
    const { nombre, apellido, dni, email, whatsapp } = req.body;
    
    logger.audit.userAction(`Intento de creación de cliente`, {
      service: 'crm-hotelero',
      userId: req.user?.id,
      userEmail: req.user?.email,
      action: 'CREATE_CLIENT',
      clientData: { nombre, apellido, dni, email },
      timestamp: new Date().toISOString()
    });

    const exists = await Client.findOne({ $or: [{ email }, { dni }] });
    if (exists) {
      logger.security.anomaly(`Cliente duplicado detectado`, {
        service: 'crm-hotelero',
        anomalyType: 'DUPLICATE_CLIENT_ATTEMPT',
        existingClientId: exists._id,
        attemptedData: { dni, email },
        userId: req.user?.id,
        severity: 'MEDIUM'
      });
      return res.status(400).json({ message: 'El email o DNI ya está registrado' });
    }
    
    const client = await Client.create({ nombre, apellido, dni, email, whatsapp });
    
    const duration = Date.now() - startTime;
    logger.performance.operation(`Cliente creado exitosamente`, {
      service: 'crm-hotelero',
      operation: 'CREATE_CLIENT',
      duration,
      clientId: client._id,
      userId: req.user?.id,
      success: true
    });

    res.status(201).json(client);
  } catch (err) {
    const duration = Date.now() - startTime;
    logger.error('Error creando cliente', {
      service: 'crm-hotelero',
      error: err.message,
      stack: err.stack,
      duration,
      userId: req.user?.id,
      event: 'CLIENT_CREATION_ERROR'
    });
    res.status(500).json({ message: 'Error creando cliente', error: err.message });
  }
};

// Listar clientes con búsqueda avanzada
exports.listClients = async (req, res) => {
  try {
    const { q } = req.query;
    let filter = {};
    if (q) {
      filter = {
        $or: [
          { nombre: { $regex: q, $options: 'i' } },
          { apellido: { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } },
          { whatsapp: { $regex: q, $options: 'i' } }
        ]
      };
    }
    const clients = await Client.find(filter).sort({ createdAt: -1 });
    res.json(clients);
  } catch (err) {
    res.status(500).json({ message: 'Error listando clientes', error: err.message });
  }
};

// Obtener cliente y su historial de reservas
exports.getClient = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ message: 'Cliente no encontrado' });
    const reservations = await Reservation.find({ client: client._id });
    res.json({ client, reservations });
  } catch (err) {
    res.status(500).json({ message: 'Error obteniendo cliente', error: err.message });
  }
};

// Actualizar cliente
exports.updateClient = async (req, res) => {
  try {
    const { nombre, apellido, dni, email, whatsapp } = req.body;
    const client = await Client.findByIdAndUpdate(
      req.params.id,
      { nombre, apellido, dni, email, whatsapp },
      { new: true }
    );
    if (!client) return res.status(404).json({ message: 'Cliente no encontrado' });
    res.json(client);
  } catch (err) {
    res.status(500).json({ message: 'Error actualizando cliente', error: err.message });
  }
};

// Eliminar cliente
exports.deleteClient = async (req, res) => {
  try {
    const client = await Client.findByIdAndDelete(req.params.id);
    if (!client) return res.status(404).json({ message: 'Cliente no encontrado' });
    res.json({ message: 'Cliente eliminado' });
  } catch (err) {
    res.status(500).json({ message: 'Error eliminando cliente', error: err.message });
  }
};
