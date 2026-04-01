// services/ReservationService.js
// Servicio centralizado para lógica de negocio de reservas

const Reservation = require('../models/Reservation');
const Room = require('../models/Room');
const Client = require('../models/Client');
const BillingService = require('./billingService');
const { assignRoomsToReservation } = require('./roomAssignmentService');
const { logger } = require('./loggerService');

class ReservationService {

  /**
   * Busca o crea un cliente a partir de los datos de contacto.
   * Si el cliente ya existe (por DNI o email), actualiza campos si cambiaron.
   */
  static async resolveClient({ nombre, apellido, dni, email, whatsapp }) {
    let client = await Client.findOne({ $or: [{ dni }, { email }] });
    if (!client) {
      client = await Client.create({ nombre, apellido, dni, email, whatsapp });
    } else {
      let updated = false;
      if (client.nombre !== nombre) { client.nombre = nombre; updated = true; }
      if (client.apellido !== apellido) { client.apellido = apellido; updated = true; }
      if (client.whatsapp !== whatsapp) { client.whatsapp = whatsapp; updated = true; }
      if (updated) await client.save();
    }
    return client;
  }

  /**
   * Valida la disponibilidad de habitaciones para un tipo y rango de fechas.
   * Retorna { available: true } o { available: false, details: {...} }
   */
  static async validateAvailability({ tipo, cantidad, checkIn, checkOut }) {
    const cantidadSolicitada = cantidad || 1;

    const habitacionesDelTipo = await Room.find({
      type: tipo,
      active: true,
      status: { $nin: ['mantenimiento', 'limpieza'] }
    }).lean();

    const totalHabitaciones = habitacionesDelTipo.length;
    if (totalHabitaciones === 0) {
      return { available: false, message: `No existen habitaciones del tipo "${tipo}".`, statusCode: 400 };
    }

    const fechaInicio = new Date(checkIn + 'T00:00:00Z');
    const fechaFin = new Date(checkOut + 'T00:00:00Z');

    // Iterar día a día para verificar disponibilidad
    const fechasReserva = [];
    for (let d = new Date(fechaInicio); d < fechaFin; d.setDate(d.getDate() + 1)) {
      fechasReserva.push(d.toISOString().split('T')[0]);
    }

    for (const fecha of fechasReserva) {
      const fechaObj = new Date(fecha + 'T00:00:00Z');
      const fechaSiguiente = new Date(fechaObj);
      fechaSiguiente.setDate(fechaSiguiente.getDate() + 1);

      const reservasEnFecha = await Reservation.find({
        tipo,
        status: { $nin: ['checkout', 'cancelada'] },
        checkIn: { $lt: fechaSiguiente },
        checkOut: { $gt: fechaObj }
      }).lean();

      let habitacionesOcupadas = 0;
      reservasEnFecha.forEach(reserva => {
        if (reserva.room && reserva.room.length > 0) {
          habitacionesOcupadas += reserva.room.length;
        } else {
          habitacionesOcupadas += (reserva.cantidad || 1);
        }
      });

      const habitacionesDisponibles = totalHabitaciones - habitacionesOcupadas;
      if (cantidadSolicitada > habitacionesDisponibles) {
        return {
          available: false,
          statusCode: 409,
          message: `No hay suficientes habitaciones ${tipo} disponibles para el ${fecha}. Solicitadas: ${cantidadSolicitada}, Disponibles: ${habitacionesDisponibles}`,
          detalles: {
            fecha, tipo, totalHabitaciones, habitacionesOcupadas, habitacionesDisponibles, cantidadSolicitada
          }
        };
      }
    }

    return { available: true };
  }

  /**
   * Crea una reserva completa: resuelve cliente, valida disponibilidad,
   * calcula pricing, guarda y asigna habitaciones.
   * @param {Object} data - Datos de la reserva
   * @param {Object} options - { session, userId, isStaff }
   * @returns {Object} - Reserva creada y populada
   * @throws {Error} - Con message y statusCode si hay error de negocio
   */
  static async createReservation(data, options = {}) {
    const { session, userId, isStaff } = options;
    let { tipo, cantidad, checkIn, checkOut, nombre, apellido, dni, email, whatsapp } = data;

    // Auto-completar datos para staff (reservas rápidas)
    if (isStaff) {
      const stamp = Date.now();
      nombre = nombre || 'Invitado';
      apellido = apellido || 'Reserva rápida';
      dni = dni || `ADM-${stamp}`;
      email = email || `guest+${stamp}@hotel.local`;
      whatsapp = whatsapp || '000000000';
    }

    // Validar campos obligatorios
    const missingFields = ['nombre', 'apellido', 'dni', 'email', 'whatsapp'].filter(f => !({ nombre, apellido, dni, email, whatsapp })[f]);
    if (missingFields.length > 0) {
      const err = new Error('Faltan datos obligatorios del cliente');
      err.statusCode = 400;
      err.details = { missingClientFields: missingFields };
      throw err;
    }

    if (!tipo) {
      const err = new Error('El tipo de habitación es obligatorio.');
      err.statusCode = 400;
      throw err;
    }

    // Validar fechas
    const checkInUTC = new Date(checkIn + 'T00:00:00Z');
    const checkOutUTC = new Date(checkOut + 'T00:00:00Z');
    if (checkInUTC >= checkOutUTC) {
      const err = new Error('La fecha de check-in debe ser anterior a la de check-out.');
      err.statusCode = 400;
      throw err;
    }

    // Resolver cliente
    const client = await this.resolveClient({ nombre, apellido, dni, email, whatsapp });

    // Validar disponibilidad
    const availability = await this.validateAvailability({ tipo, cantidad, checkIn, checkOut });
    if (!availability.available) {
      const err = new Error(availability.message);
      err.statusCode = availability.statusCode;
      err.details = availability.detalles;
      throw err;
    }

    // Calcular pricing
    const pricing = await BillingService.calculateReservationPricing({ tipo, cantidad, checkIn, checkOut });

    // Crear reserva
    const reservation = new Reservation({
      tipo,
      cantidad: cantidad || 1,
      user: userId,
      client: client._id,
      checkIn,
      checkOut,
      pricing: {
        pricePerNight: pricing.pricePerNight,
        totalNights: pricing.totalNights,
        subtotal: pricing.subtotal,
        taxes: pricing.taxes,
        total: pricing.total,
        currency: pricing.currency
      },
      payment: {
        status: 'pendiente',
        method: 'efectivo',
        amountPaid: 0
      },
      invoice: {
        isPaid: false
      }
    });

    const saveOptions = session ? { session } : undefined;
    await reservation.save(saveOptions);

    logger.info(`Reserva creada: ${reservation._id} — ${tipo} x${cantidad || 1} del ${checkIn} al ${checkOut} — $${pricing.total}`);

    // Asignar habitaciones automáticamente
    await assignRoomsToReservation(reservation, { session });

    // Retornar reserva populada
    const populated = await Reservation.findById(reservation._id).populate('room client');
    return populated;
  }

  static async updateReservation(id, data) {
    const reservation = await Reservation.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!reservation) {
      throw new Error('Reserva no encontrada');
    }
    logger.info(`Reserva actualizada: ${reservation._id}`);
    return reservation;
  }

  static async deleteReservation(id) {
    const reservation = await Reservation.findByIdAndDelete(id);
    if (!reservation) {
      throw new Error('Reserva no encontrada');
    }
    logger.info(`Reserva eliminada: ${reservation._id}`);
    return reservation;
  }

  static async findReservationsByDateRange(startDate, endDate) {
    return Reservation.find({
      checkIn: { $lt: endDate },
      checkOut: { $gt: startDate },
    });
  }
}

module.exports = ReservationService;