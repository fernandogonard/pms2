// controllers/reservationController.js - Agregamos el endpoint optimizado
const Reservation = require('../models/Reservation');
const Room = require('../models/Room');
const Client = require('../models/Client');
const { logger } = require('../config/logger');
const { assignRoomsToReservation, processCheckin, processCheckout } = require('../services/roomAssignmentService');

// Endpoint optimizado para cientos de reservas
exports.getReservationsOptimized = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      startDate,
      endDate,
      status,
      tipo,
      clientSearch,
      roomNumber,
      sortBy = 'checkIn',
      sortOrder = 'desc'
    } = req.query;

    const timestamp = new Date().toISOString();
    logger.info(`[${timestamp}] Consulta optimizada de reservas`, {
      page, limit, startDate, endDate, status, tipo, clientSearch, roomNumber
    });

    // Construir filtro dinámico
    const filter = {};
    
    // Filtros de fecha
    if (startDate || endDate) {
      filter.$and = [];
      if (startDate) {
        filter.$and.push({ checkIn: { $gte: new Date(startDate) } });
      }
      if (endDate) {
        filter.$and.push({ checkOut: { $lte: new Date(endDate) } });
      }
    }

    // Filtros adicionales
    if (status && status !== '') {
      filter.status = status;
    }

    if (tipo && tipo !== '') {
      filter.tipo = tipo;
    }

    // Pipeline de agregación para búsquedas complejas
    const pipeline = [
      { $match: filter },
      {
        $lookup: {
          from: 'clients',
          localField: 'client',
          foreignField: '_id',
          as: 'clientData',
          pipeline: [
            {
              $project: {
                nombre: 1,
                apellido: 1,
                email: 1,
                telefono: 1
              }
            }
          ]
        }
      },
      {
        $lookup: {
          from: 'rooms',
          localField: 'room',
          foreignField: '_id',
          as: 'roomData',
          pipeline: [
            {
              $project: {
                number: 1,
                type: 1,
                price: 1
              }
            }
          ]
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userData',
          pipeline: [
            {
              $project: {
                username: 1,
                role: 1
              }
            }
          ]
        }
      }
    ];

    // Filtro de búsqueda de cliente
    if (clientSearch && clientSearch !== '') {
      pipeline.push({
        $match: {
          $or: [
            { 'clientData.nombre': { $regex: clientSearch, $options: 'i' } },
            { 'clientData.apellido': { $regex: clientSearch, $options: 'i' } },
            { 'clientData.email': { $regex: clientSearch, $options: 'i' } },
            { name: { $regex: clientSearch, $options: 'i' } },
            { email: { $regex: clientSearch, $options: 'i' } }
          ]
        }
      });
    }

    // Filtro de habitación
    if (roomNumber && roomNumber !== '') {
      pipeline.push({
        $match: {
          'roomData.number': { $regex: roomNumber.toString(), $options: 'i' }
        }
      });
    }

    // Contar total para paginación (pipeline separado para eficiencia)
    const countPipeline = [...pipeline, { $count: "total" }];
    const countResult = await Reservation.aggregate(countPipeline);
    const total = countResult[0]?.total || 0;

    // Ordenamiento
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
    pipeline.push({ $sort: sort });

    // Paginación
    const skip = (page - 1) * parseInt(limit);
    pipeline.push(
      { $skip: skip },
      { $limit: parseInt(limit) }
    );

    // Agregar campos calculados
    pipeline.push({
      $addFields: {
        client: { $arrayElemAt: ['$clientData', 0] },
        room: '$roomData',
        user: { $arrayElemAt: ['$userData', 0] },
        duration: {
          $divide: [
            { $subtract: ['$checkOut', '$checkIn'] },
            1000 * 60 * 60 * 24 // Convertir a días
          ]
        },
        totalAmount: {
          $multiply: [
            { $sum: '$roomData.price' },
            {
              $divide: [
                { $subtract: ['$checkOut', '$checkIn'] },
                1000 * 60 * 60 * 24
              ]
            }
          ]
        }
      }
    });

    // Limpiar datos no necesarios
    pipeline.push({
      $project: {
        clientData: 0,
        roomData: 0,
        userData: 0
      }
    });

    // Ejecutar consulta
    const startTime = Date.now();
    const reservations = await Reservation.aggregate(pipeline);
    const endTime = Date.now();

    // Estadísticas de la consulta
    const stats = {
      totalReservations: total,
      queryTime: endTime - startTime,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      itemsPerPage: parseInt(limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1
    };

    logger.info(`[${timestamp}] Consulta completada en ${stats.queryTime}ms`, {
      total, page, limit, queryTime: stats.queryTime
    });

    // Respuesta optimizada
    res.json({
      success: true,
      data: {
        reservations,
        pagination: {
          currentPage: stats.page,
          totalPages: stats.totalPages,
          totalItems: stats.totalReservations,
          itemsPerPage: stats.itemsPerPage,
          hasNextPage: stats.hasNextPage,
          hasPrevPage: stats.hasPrevPage
        },
        filters: {
          startDate, 
          endDate, 
          status, 
          tipo, 
          clientSearch, 
          roomNumber,
          sortBy,
          sortOrder
        },
        performance: {
          queryTime: stats.queryTime,
          optimized: true
        }
      },
      timestamp
    });

  } catch (error) {
    const timestamp = new Date().toISOString();
    logger.error(`[${timestamp}] Error en consulta optimizada de reservas`, {
      error: error.message,
      stack: error.stack,
      params: req.query
    });
    
    res.status(500).json({ 
      success: false,
      message: 'Error al obtener reservas optimizadas', 
      error: error.message,
      timestamp
    });
  }
};

// Endpoint para estadísticas rápidas del dashboard
exports.getReservationStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Filtro de fecha
    const dateFilter = {};
    if (startDate) dateFilter.checkIn = { $gte: new Date(startDate) };
    if (endDate) dateFilter.checkOut = { $lte: new Date(endDate) };

    // Pipeline de estadísticas
    const stats = await Reservation.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalReservations: { $sum: 1 },
          reservadas: {
            $sum: { $cond: [{ $eq: ['$status', 'reservada'] }, 1, 0] }
          },
          checkin: {
            $sum: { $cond: [{ $eq: ['$status', 'checkin'] }, 1, 0] }
          },
          checkout: {
            $sum: { $cond: [{ $eq: ['$status', 'checkout'] }, 1, 0] }
          },
          canceladas: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelada'] }, 1, 0] }
          },
          ocupadasHoy: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $lte: ['$checkIn', today] },
                    { $gt: ['$checkOut', today] },
                    { $eq: ['$status', 'checkin'] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    // Estadísticas por tipo de habitación
    const statsByType = await Reservation.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$tipo',
          count: { $sum: 1 },
          revenue: {
            $sum: {
              $multiply: [
                50, // Precio base, debería calcularse dinámicamente
                {
                  $divide: [
                    { $subtract: ['$checkOut', '$checkIn'] },
                    1000 * 60 * 60 * 24
                  ]
                }
              ]
            }
          }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        general: stats[0] || {
          totalReservations: 0,
          reservadas: 0,
          checkin: 0,
          checkout: 0,
          canceladas: 0,
          ocupadasHoy: 0
        },
        byType: statsByType,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error al obtener estadísticas de reservas:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al obtener estadísticas', 
      error: error.message 
    });
  }
};