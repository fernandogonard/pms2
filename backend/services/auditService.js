// services/auditService.js
// Servicio para registrar entradas de auditoría de forma sencilla

const AuditLog = require('../models/AuditLog');

/**
 * Registra una acción en el historial de auditoría.
 * No lanza excepciones — si falla, solo loguea el error.
 */
const log = async ({
  action,
  entity,
  entityId,
  userId,
  userEmail,
  userRole,
  description,
  details,
  ip
}) => {
  try {
    await AuditLog.create({
      action: action || 'OTRO',
      entity: entity || 'Sistema',
      entityId: entityId ? String(entityId) : undefined,
      userId,
      userEmail: userEmail || 'sistema',
      userRole: userRole || 'sistema',
      description,
      details,
      ip
    });
  } catch (err) {
    // La auditoría nunca debe interrumpir el flujo principal
    console.warn('[AuditService] Error al guardar log:', err.message);
  }
};

module.exports = { log };
