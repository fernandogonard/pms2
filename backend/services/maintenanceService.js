// services/maintenanceService.js
// Servicio para gestionar mantenimientos de habitaciones, con manejo inteligente de reservas y ocupación

const Room = require('../models/Room');
const Reservation = require('../models/Reservation');
const { ROOM_STATES } = require('../services/stateValidationService');
const { logger } = require('../config/logger');

/**
 * Clase para manejar la lógica de mantenimiento de habitaciones
 * con soporte para relocalización de huéspedes y reasignación de reservas
 */
class MaintenanceService {
  /**
   * Marca una habitación en estado de mantenimiento con validación completa
   * @param {String} roomId - ID de la habitación a mantener
   * @param {Object} maintenanceData - Datos del mantenimiento
   * @param {String} maintenanceData.reason - Motivo del mantenimiento
   * @param {Number} maintenanceData.estimatedDays - Días estimados de mantenimiento
   * @param {String} maintenanceData.priority - Prioridad: 'normal', 'high', 'urgent'
   * @param {Boolean} maintenanceData.forceIfOccupied - Forzar mantenimiento aunque esté ocupada
   * @param {String} maintenanceData.requestedBy - Usuario que solicita el mantenimiento
   * @returns {Promise<Object>} - Resultado de la operación
   */
  static async setRoomMaintenance(roomId, maintenanceData) {
    try {
      const timestamp = new Date().toISOString();
      logger.info(`[${timestamp}] Solicitud de mantenimiento para habitación ${roomId}`, {
        maintenanceData,
        action: 'MAINTENANCE_REQUEST'
      });
      
      // 1. Verificar existencia de la habitación
      const room = await Room.findById(roomId);
      if (!room) {
        throw new Error('Habitación no encontrada');
      }
      
      // VALIDACIÓN ADICIONAL: Asegurarse de que no estamos poniendo en mantenimiento una habitación ya ocupada
      // sin manejo apropiado
      if (room.status === ROOM_STATES.OCUPADA && !maintenanceData.forceIfOccupied) {
        throw new Error('La habitación está ocupada. No se puede poner en mantenimiento sin relocalizar huéspedes.');
      }

      // 2. Preparar datos para historial de mantenimiento
      const maintenanceInfo = {
        reason: maintenanceData.reason || 'No especificado',
        startDate: new Date(),
        estimatedEndDate: new Date(
          Date.now() + (maintenanceData.estimatedDays || 1) * 24 * 60 * 60 * 1000
        ),
        priority: maintenanceData.priority || 'normal',
        requestedBy: maintenanceData.requestedBy || 'sistema',
        status: 'en_proceso'
      };
      
      // Si no tenía historial de mantenimiento, crear array
      if (!room.maintenanceHistory) {
        room.maintenanceHistory = [];
      }

      // 3. VALIDACIÓN CRÍTICA: Verificar si la habitación está ocupada
      if (room.status === ROOM_STATES.OCUPADA) {
        logger.warn(`[${timestamp}] Intento de mantenimiento en habitación OCUPADA #${room.number}`, {
          roomStatus: room.status,
          action: 'MAINTENANCE_CONFLICT'
        });

        // Buscar la reserva activa con check-in para esta habitación
        const activeReservation = await Reservation.findOne({
          room: roomId,
          status: 'checkin'
        }).populate('client');
        
        if (activeReservation) {
          if (!maintenanceData.forceIfOccupied) {
            return {
              success: false,
              message: `No se puede realizar mantenimiento: Habitación #${room.number} ocupada por ${activeReservation.client?.name || 'un huésped'}`,
              status: 'conflict',
              currentOccupancy: {
                reservationId: activeReservation._id,
                guestName: activeReservation.client?.name,
                checkIn: activeReservation.checkIn,
                checkOut: activeReservation.checkOut
              },
              room
            };
          } else {
            // RELOCALIZACIÓN DE HUÉSPEDES
            const relocationResult = await this.relocateGuests(room, activeReservation, maintenanceData);
            
            if (!relocationResult.success) {
              return relocationResult;
            }
            
            logger.info(`[${timestamp}] Relocalización exitosa de huésped para mantenimiento`, {
              roomNumber: room.number,
              reservationId: activeReservation._id,
              newRoomId: relocationResult.newRoomId,
              action: 'GUEST_RELOCATED'
            });
          }
        }
      }

      // 4. VALIDACIÓN CRÍTICA: Verificar reservas futuras
      const affectedReservations = await this.findFutureReservations(roomId, maintenanceInfo.estimatedEndDate);
      
      if (affectedReservations.length > 0 && !maintenanceData.forceIfOccupied) {
        return {
          success: false,
          message: `Mantenimiento afectaría ${affectedReservations.length} reservas futuras`,
          status: 'conflict',
          affectedReservations: affectedReservations.map(r => ({
            id: r._id,
            checkIn: r.checkIn,
            checkOut: r.checkOut,
            clientName: r.client?.name || 'Cliente'
          })),
          room
        };
      } else if (affectedReservations.length > 0) {
        // REASIGNACIÓN DE RESERVAS FUTURAS
        const reassignmentResult = await this.reassignFutureReservations(
          room, 
          affectedReservations, 
          maintenanceInfo.estimatedEndDate
        );
        
        if (!reassignmentResult.success) {
          return reassignmentResult;
        }
        
        logger.info(`[${timestamp}] Reasignadas ${reassignmentResult.reassignedCount} reservas futuras`, {
          roomNumber: room.number,
          reassignedCount: reassignmentResult.reassignedCount,
          failedCount: reassignmentResult.failedCount,
          action: 'RESERVATIONS_REASSIGNED'
        });
      }

      // 5. Actualizar habitación a mantenimiento
      room.status = ROOM_STATES.MANTENIMIENTO;
      room.maintenanceHistory.push(maintenanceInfo);
      
      // Agregar detalles de mantenimiento actual
      room.currentMaintenance = {
        reason: maintenanceInfo.reason,
        startDate: maintenanceInfo.startDate,
        estimatedEndDate: maintenanceInfo.estimatedEndDate,
        priority: maintenanceInfo.priority,
        requestedBy: maintenanceInfo.requestedBy
      };
      
      await room.save();
      
      logger.info(`[${timestamp}] Habitación #${room.number} marcada como EN MANTENIMIENTO`, {
        roomNumber: room.number,
        estimatedDays: maintenanceData.estimatedDays || 1,
        reason: maintenanceData.reason,
        action: 'MAINTENANCE_STARTED'
      });
      
      return {
        success: true,
        message: `Habitación #${room.number} en mantenimiento por "${maintenanceInfo.reason}"`,
        estimatedEndDate: maintenanceInfo.estimatedEndDate,
        room
      };
    } catch (error) {
      logger.error(`Error al establecer mantenimiento: ${error.message}`, {
        error: error.stack,
        roomId,
        action: 'MAINTENANCE_ERROR'
      });
      throw error;
    }
  }

  /**
   * Finaliza el mantenimiento de una habitación
   * @param {String} roomId - ID de la habitación
   * @param {Object} completionData - Datos de finalización
   * @returns {Promise<Object>} - Resultado de la operación
   */
  static async completeMaintenance(roomId, completionData) {
    try {
      const room = await Room.findById(roomId);
      if (!room) {
        throw new Error('Habitación no encontrada');
      }
      
      if (room.status !== ROOM_STATES.MANTENIMIENTO) {
        throw new Error(`La habitación #${room.number} no está en mantenimiento`);
      }
      
      // Actualizar historial de mantenimiento
      if (room.maintenanceHistory && room.maintenanceHistory.length > 0) {
        const lastMaintenance = room.maintenanceHistory[room.maintenanceHistory.length - 1];
        if (lastMaintenance.status === 'en_proceso') {
          lastMaintenance.endDate = new Date();
          lastMaintenance.status = 'completado';
          lastMaintenance.notes = completionData.notes || '';
          lastMaintenance.completedBy = completionData.completedBy || 'sistema';
        }
      }
      
      // Actualizar estado - después de mantenimiento va a limpieza
      room.status = completionData.requiresCleaning !== false ? 
        ROOM_STATES.LIMPIEZA : 
        ROOM_STATES.DISPONIBLE;
      
      // Limpiar mantenimiento actual
      room.currentMaintenance = null;
      
      await room.save();
      
      logger.info(`Mantenimiento finalizado para habitación #${room.number}`, {
        roomNumber: room.number,
        newStatus: room.status,
        completedBy: completionData.completedBy,
        action: 'MAINTENANCE_COMPLETED'
      });
      
      return {
        success: true,
        message: `Mantenimiento finalizado. Habitación #${room.number} ahora en estado ${room.status}`,
        room
      };
    } catch (error) {
      logger.error(`Error al finalizar mantenimiento: ${error.message}`, {
        error: error.stack,
        roomId,
        action: 'MAINTENANCE_COMPLETION_ERROR'
      });
      throw error;
    }
  }
  
  /**
   * Encuentra habitaciones disponibles similares para relocalizar huéspedes
   * @param {Object} originalRoom - Habitación original
   * @returns {Promise<Object>} - Habitación alternativa o null
   */
  static async findAlternativeRoom(originalRoom) {
    try {
      // Buscar habitaciones del mismo tipo y disponibles
      const alternativeRooms = await Room.find({
        _id: { $ne: originalRoom._id }, // No la misma habitación
        type: originalRoom.type,        // Mismo tipo
        status: ROOM_STATES.DISPONIBLE  // Disponible
      }).sort({ number: 1 }).limit(1);
      
      return alternativeRooms.length > 0 ? alternativeRooms[0] : null;
    } catch (error) {
      logger.error(`Error buscando habitación alternativa: ${error.message}`, {
        error: error.stack,
        originalRoomId: originalRoom._id,
        action: 'FIND_ALTERNATIVE_ERROR'
      });
      return null;
    }
  }
  
  /**
   * Relocaliza huéspedes de una habitación ocupada a otra
   * @param {Object} originalRoom - Habitación original
   * @param {Object} reservation - Reserva activa
   * @param {Object} maintenanceData - Datos del mantenimiento
   * @returns {Promise<Object>} - Resultado de la relocalización
   */
  static async relocateGuests(originalRoom, reservation, maintenanceData) {
    try {
      // Encontrar habitación alternativa
      const alternativeRoom = await this.findAlternativeRoom(originalRoom);
      
      if (!alternativeRoom) {
        // No hay alternativa y se está forzando - situación crítica
        if (maintenanceData.priority === 'urgent' && maintenanceData.forceIfOccupied) {
          logger.warn(`MANTENIMIENTO URGENTE: No hay alternativas para relocalizar huésped de #${originalRoom.number}`, {
            roomNumber: originalRoom.number,
            reservationId: reservation._id,
            action: 'FORCED_MAINTENANCE'
          });
          
          return {
            success: true,
            message: `ATENCIÓN: Mantenimiento URGENTE forzado. SE DEBE RELOCALIZAR MANUALMENTE al huésped de la habitación #${originalRoom.number}`,
            warning: true,
            relocationType: 'manual',
            reservationId: reservation._id,
            guestName: reservation.client?.name
          };
        } else {
          return {
            success: false,
            message: `No hay habitaciones alternativas disponibles para relocalizar al huésped de la habitación #${originalRoom.number}`,
            status: 'no_alternatives',
            room: originalRoom
          };
        }
      }
      
      // Actualizar reserva con nueva habitación
      const oldRoomIds = reservation.room.map(r => r.toString());
      const newRoomIds = [...oldRoomIds.filter(id => id !== originalRoom._id.toString()), alternativeRoom._id];
      
      reservation.room = newRoomIds;
      await reservation.save();
      
      // Marcar habitación alternativa como ocupada
      alternativeRoom.status = ROOM_STATES.OCUPADA;
      await alternativeRoom.save();
      
      logger.info(`Huésped relocalizado de #${originalRoom.number} a #${alternativeRoom.number}`, {
        originalRoomNumber: originalRoom.number,
        newRoomNumber: alternativeRoom.number,
        reservationId: reservation._id,
        guestName: reservation.client?.name,
        action: 'GUEST_RELOCATED'
      });
      
      return {
        success: true,
        message: `Huésped relocalizado exitosamente de habitación #${originalRoom.number} a #${alternativeRoom.number}`,
        relocationType: 'automatic',
        newRoomId: alternativeRoom._id,
        newRoomNumber: alternativeRoom.number,
        reservationId: reservation._id,
        guestName: reservation.client?.name
      };
    } catch (error) {
      logger.error(`Error en relocalización: ${error.message}`, {
        error: error.stack,
        roomId: originalRoom._id,
        reservationId: reservation._id,
        action: 'RELOCATION_ERROR'
      });
      
      return {
        success: false,
        message: `Error al relocalizar huésped: ${error.message}`,
        status: 'error',
        error: error.message
      };
    }
  }
  
  /**
   * Encuentra reservas futuras que afectaría el mantenimiento
   * @param {String} roomId - ID de la habitación
   * @param {Date} maintenanceEndDate - Fecha estimada de fin de mantenimiento
   * @returns {Promise<Array>} - Reservas afectadas
   */
  static async findFutureReservations(roomId, maintenanceEndDate) {
    try {
      // Buscar reservas futuras para esta habitación
      const futureReservations = await Reservation.find({
        room: roomId,
        status: 'reservada',  // Solo reservas pendientes, no check-in ni checkout
        checkIn: { $lte: maintenanceEndDate }  // Check-in antes o durante mantenimiento
      }).populate('client').sort({ checkIn: 1 });
      
      return futureReservations;
    } catch (error) {
      logger.error(`Error buscando reservas futuras: ${error.message}`, {
        error: error.stack,
        roomId,
        action: 'FIND_RESERVATIONS_ERROR'
      });
      return [];
    }
  }
  
  /**
   * Reasigna reservas futuras afectadas por mantenimiento
   * @param {Object} originalRoom - Habitación original
   * @param {Array} affectedReservations - Reservas afectadas
   * @param {Date} maintenanceEndDate - Fecha estimada de fin de mantenimiento
   * @returns {Promise<Object>} - Resultado de la reasignación
   */
  static async reassignFutureReservations(originalRoom, affectedReservations, maintenanceEndDate) {
    try {
      let reassignedCount = 0;
      let failedCount = 0;
      const reassignmentDetails = [];
      
      // Procesar cada reserva afectada
      for (const reservation of affectedReservations) {
        // Si el check-in es después del fin de mantenimiento, no hacer nada
        const checkInDate = new Date(reservation.checkIn);
        if (checkInDate > maintenanceEndDate) continue;
        
        // Encontrar habitación alternativa para esta reserva
        const alternativeRoom = await this.findAlternativeRoom(originalRoom);
        
        if (alternativeRoom) {
          // Actualizar reserva con nueva habitación
          const oldRoomIds = reservation.room.map(r => r.toString());
          const newRoomIds = [...oldRoomIds.filter(id => id !== originalRoom._id.toString()), alternativeRoom._id];
          
          reservation.room = newRoomIds;
          await reservation.save();
          
          reassignedCount++;
          reassignmentDetails.push({
            reservationId: reservation._id,
            clientName: reservation.client?.name,
            checkIn: reservation.checkIn,
            oldRoom: originalRoom.number,
            newRoom: alternativeRoom.number,
            success: true
          });
          
          logger.info(`Reserva ${reservation._id} reasignada de #${originalRoom.number} a #${alternativeRoom.number}`, {
            originalRoomNumber: originalRoom.number,
            newRoomNumber: alternativeRoom.number,
            reservationId: reservation._id,
            checkIn: reservation.checkIn,
            action: 'RESERVATION_REASSIGNED'
          });
        } else {
          failedCount++;
          reassignmentDetails.push({
            reservationId: reservation._id,
            clientName: reservation.client?.name,
            checkIn: reservation.checkIn,
            oldRoom: originalRoom.number,
            success: false,
            reason: 'No hay habitaciones alternativas disponibles'
          });
          
          logger.warn(`No se pudo reasignar reserva ${reservation._id}`, {
            roomNumber: originalRoom.number,
            reservationId: reservation._id,
            checkIn: reservation.checkIn,
            action: 'RESERVATION_REASSIGN_FAILED'
          });
        }
      }
      
      return {
        success: true,
        message: `Reasignadas ${reassignedCount} de ${affectedReservations.length} reservas`,
        reassignedCount,
        failedCount,
        details: reassignmentDetails
      };
    } catch (error) {
      logger.error(`Error reasignando reservas: ${error.message}`, {
        error: error.stack,
        roomId: originalRoom._id,
        action: 'REASSIGN_ERROR'
      });
      
      return {
        success: false,
        message: `Error al reasignar reservas: ${error.message}`,
        status: 'error',
        error: error.message
      };
    }
  }
  
  /**
   * Obtiene todas las habitaciones en mantenimiento
   * @returns {Promise<Array>} - Habitaciones en mantenimiento
   */
  static async getRoomsInMaintenance() {
    try {
      return await Room.find({ 
        status: ROOM_STATES.MANTENIMIENTO 
      }).sort({ number: 1 });
    } catch (error) {
      logger.error(`Error obteniendo habitaciones en mantenimiento: ${error.message}`, {
        error: error.stack,
        action: 'GET_MAINTENANCE_ERROR'
      });
      throw error;
    }
  }
}

module.exports = MaintenanceService;