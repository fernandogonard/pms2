// controllers/relocationController.js
// Controlador para la relocalización de huéspedes entre habitaciones

const Room = require('../models/Room');
const Reservation = require('../models/Reservation');
const ErrorHandlingService = require('../services/errorHandlingService');
const { ROOM_STATES } = require('../services/stateValidationService');
const { logger } = require('../config/logger');

/**
 * @desc   Relocaliza a un huésped de una habitación a otra
 * @route  POST /api/rooms/:id/relocate
 * @access Private/Admin
 */
exports.relocateGuest = ErrorHandlingService.asyncWrapper(async (req, res) => {
  const sourceRoomId = req.params.id;
  const { targetRoomId, reason } = req.body;

  // Validación de campos
  ErrorHandlingService.validateRequiredFields(req.body, ['targetRoomId'], 'relocateGuest');
  
  // Verificar habitación origen
  const sourceRoom = await Room.findById(sourceRoomId);
  if (!sourceRoom) {
    throw ErrorHandlingService.createBusinessError('Habitación de origen no encontrada', 404);
  }
  
  // Verificar que la habitación origen está ocupada
  if (sourceRoom.status !== ROOM_STATES.OCUPADA) {
    throw ErrorHandlingService.createBusinessError('La habitación de origen no está ocupada', 400);
  }
  
  // Verificar habitación destino
  const targetRoom = await Room.findById(targetRoomId);
  if (!targetRoom) {
    throw ErrorHandlingService.createBusinessError('Habitación de destino no encontrada', 404);
  }
  
  // Verificar que la habitación destino está disponible
  if (targetRoom.status !== ROOM_STATES.DISPONIBLE) {
    throw ErrorHandlingService.createBusinessError('La habitación de destino no está disponible', 400);
  }
  
  // Buscar la reserva activa con check-in para la habitación origen
  const activeReservation = await Reservation.findOne({
    room: sourceRoomId,
    status: 'checkin'
  }).populate('client');
  
  if (!activeReservation) {
    throw ErrorHandlingService.createBusinessError('No se encontró una reserva activa para la habitación', 404);
  }
  
  // Actualizar reserva con nueva habitación
  const oldRoomIds = activeReservation.room.map(r => r.toString());
  const newRoomIds = [...oldRoomIds.filter(id => id !== sourceRoomId.toString()), targetRoomId];
  
  activeReservation.room = newRoomIds;
  await activeReservation.save();
  
  // Actualizar estados de las habitaciones
  sourceRoom.status = ROOM_STATES.LIMPIEZA; // La habitación que queda vacía pasa a limpieza
  targetRoom.status = ROOM_STATES.OCUPADA;  // La habitación destino pasa a ocupada
  
  await sourceRoom.save();
  await targetRoom.save();
  
  // Registrar la relocalización
  logger.info(`Huésped relocalizado manualmente de #${sourceRoom.number} a #${targetRoom.number}`, {
    originalRoomNumber: sourceRoom.number,
    newRoomNumber: targetRoom.number,
    reservationId: activeReservation._id,
    guestName: activeReservation.client?.name,
    reason: reason || 'Relocalización manual',
    action: 'MANUAL_GUEST_RELOCATION'
  });
  
  // Emitir evento WebSocket para actualizar el tablero
  const wss = req.app.get('wss');
  if (wss) {
    wss.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(JSON.stringify({ 
          type: 'guest_relocated', 
          data: {
            sourceRoom: {
              id: sourceRoom._id,
              number: sourceRoom.number,
              status: sourceRoom.status
            },
            targetRoom: {
              id: targetRoom._id,
              number: targetRoom.number,
              status: targetRoom.status
            },
            guestName: activeReservation.client?.name
          }
        }));
      }
    });
  }
  
  // Respuesta exitosa
  res.json({
    success: true,
    message: `Huésped relocalizado con éxito de habitación #${sourceRoom.number} a #${targetRoom.number}`,
    relocation: {
      reservationId: activeReservation._id,
      guestName: activeReservation.client?.name,
      sourceRoom: {
        id: sourceRoom._id,
        number: sourceRoom.number
      },
      targetRoom: {
        id: targetRoom._id,
        number: targetRoom.number
      }
    }
  });
});