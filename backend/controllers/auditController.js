// controllers/auditController.js
// Endpoints para consultar el historial de auditoría (solo admin)

const AuditLog = require('../models/AuditLog');

/**
 * GET /api/audit
 * Query params: page, limit, action, entity, userEmail, dateFrom, dateTo
 */
const getAuditLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      action,
      entity,
      userEmail,
      dateFrom,
      dateTo
    } = req.query;

    const filter = {};

    if (action)    filter.action    = action;
    if (entity)    filter.entity    = entity;
    if (userEmail) filter.userEmail = { $regex: userEmail, $options: 'i' };

    if (dateFrom || dateTo) {
      filter.timestamp = {};
      if (dateFrom) filter.timestamp.$gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        filter.timestamp.$lte = end;
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      AuditLog.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error obteniendo audit logs:', error);
    res.status(500).json({ success: false, message: 'Error obteniendo historial de auditoría' });
  }
};

/**
 * GET /api/audit/actions
 * Devuelve lista de tipos de acción únicos (para filtros)
 */
const getActionTypes = async (req, res) => {
  try {
    const actions = await AuditLog.distinct('action');
    res.json({ success: true, data: actions.sort() });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error obteniendo acciones' });
  }
};

/**
 * GET /api/audit/stats
 * Estadísticas rápidas del día
 */
const getAuditStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalToday, totalAll, byAction] = await Promise.all([
      AuditLog.countDocuments({ timestamp: { $gte: today } }),
      AuditLog.countDocuments(),
      AuditLog.aggregate([
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ])
    ]);

    res.json({
      success: true,
      data: { totalToday, totalAll, byAction }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error obteniendo estadísticas' });
  }
};

module.exports = { getAuditLogs, getActionTypes, getAuditStats };
