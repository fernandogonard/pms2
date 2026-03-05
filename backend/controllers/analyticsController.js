// controllers/analyticsController.js
// Controlador para analytics avanzados del hotel

const Room = require('../models/Room');
const Reservation = require('../models/Reservation');
const Client = require('../models/Client');
const ErrorHandlingService = require('../services/errorHandlingService');

// Obtener datos de ocupación en el tiempo
exports.getOccupancyTrend = ErrorHandlingService.asyncWrapper(async (req, res) => {
    const { range = '7d' } = req.query;
    
    // Calcular fechas según el rango
    const endDate = new Date();
    const startDate = new Date();
    
    switch (range) {
        case '7d':
            startDate.setDate(endDate.getDate() - 7);
            break;
        case '30d':
            startDate.setDate(endDate.getDate() - 30);
            break;
        case '90d':
            startDate.setDate(endDate.getDate() - 90);
            break;
        default:
            startDate.setDate(endDate.getDate() - 7);
    }

    // ─── Reemplaza N+1 loop (1 query/día) por una sola aggregation ───────────────
    const totalRooms = await Room.countDocuments();

    // Genera array de fechas del período
    const days = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        days.push(new Date(d).toISOString().split('T')[0]);
    }

    // Una sola query: reservas activas en el rango completo
    const reservationsInRange = await Reservation.find({
        checkIn: { $lte: endDate },
        checkOut: { $gte: startDate },
        status: { $in: ['checkin', 'confirmed', 'checked-in'] }
    }, { checkIn: 1, checkOut: 1, 'pricing.total': 1 }).lean();

    // Para cada día, contar reservas activas en memoria (O(días × reservas) pero sin N+1)
    const occupancyData = days.map(dayStr => {
        const dayStart = new Date(dayStr + 'T00:00:00.000Z');
        const dayEnd   = new Date(dayStr + 'T23:59:59.999Z');
        const active = reservationsInRange.filter(r =>
            new Date(r.checkIn) <= dayEnd && new Date(r.checkOut) >= dayStart
        );
        const occupiedRooms  = active.length;
        const occupancyRate  = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;
        const totalRevenue   = active.reduce((s, r) => s + (r.pricing?.total || 0), 0);
        const adr = occupiedRooms > 0 ? totalRevenue / occupiedRooms : 0;
        return {
            date: dayStr,
            occupancyRate: Math.round(occupancyRate * 100) / 100,
            adr: Math.round(adr * 100) / 100,
            occupiedRooms,
            totalRooms
        };
    });

    res.json(occupancyData);
});

// Obtener datos de ingresos
exports.getRevenueData = ErrorHandlingService.asyncWrapper(async (req, res) => {
    const { range = '7d' } = req.query;
    
    const endDate = new Date();
    const startDate = new Date();
    
    switch (range) {
        case '7d':
            startDate.setDate(endDate.getDate() - 7);
            break;
        case '30d':
            startDate.setDate(endDate.getDate() - 30);
            break;
        case '90d':
            startDate.setDate(endDate.getDate() - 90);
            break;
    }

    // Agregar ingresos por día usando MongoDB aggregation
    const revenueData = await Reservation.aggregate([
        {
            $match: {
                checkIn: { $gte: startDate, $lte: endDate },
                status: { $in: ['confirmed', 'checked-in', 'checked-out'] },
                totalPrice: { $exists: true, $ne: null }
            }
        },
        {
            $group: {
                _id: {
                    $dateToString: { format: "%Y-%m-%d", date: "$checkIn" }
                },
                revenue: { $sum: "$totalPrice" },
                reservations: { $sum: 1 }
            }
        },
        {
            $sort: { "_id": 1 }
        }
    ]);

    // Formatear los datos
    const formattedData = revenueData.map(item => ({
        date: item._id,
        revenue: Math.round(item.revenue * 100) / 100,
        reservations: item.reservations
    }));

    res.json(formattedData);
});

// Obtener distribución por tipo de habitación
exports.getRoomTypeDistribution = ErrorHandlingService.asyncWrapper(async (req, res) => {
    const { range = '7d' } = req.query;
    
    const endDate = new Date();
    const startDate = new Date();
    
    switch (range) {
        case '7d':
            startDate.setDate(endDate.getDate() - 7);
            break;
        case '30d':
            startDate.setDate(endDate.getDate() - 30);
            break;
        case '90d':
            startDate.setDate(endDate.getDate() - 90);
            break;
    }

    // Obtener distribución de reservas por tipo de habitación
    const roomTypeData = await Reservation.aggregate([
        {
            $match: {
                checkIn: { $gte: startDate, $lte: endDate },
                status: { $in: ['confirmed', 'checked-in', 'checked-out'] }
            }
        },
        {
            $lookup: {
                from: 'rooms',
                localField: 'assignedRooms',
                foreignField: '_id',
                as: 'rooms'
            }
        },
        {
            $unwind: '$rooms'
        },
        {
            $group: {
                _id: '$rooms.type',
                count: { $sum: 1 },
                revenue: { $sum: '$totalPrice' }
            }
        }
    ]);

    // Si no hay datos de reservas, obtener tipos de habitaciones disponibles
    if (roomTypeData.length === 0) {
        const roomTypes = await Room.aggregate([
            {
                $group: {
                    _id: '$type',
                    count: { $sum: 1 }
                }
            }
        ]);

        const formattedTypes = roomTypes.map(item => ({
            type: item._id || 'Estándar',
            count: item.count,
            revenue: 0
        }));

        return res.json(formattedTypes);
    }

    const formattedData = roomTypeData.map(item => ({
        type: item._id || 'Estándar',
        count: item.count,
        revenue: Math.round(item.revenue * 100) / 100
    }));

    res.json(formattedData);
});

// Obtener tendencia de check-ins/check-outs
exports.getCheckinTrend = ErrorHandlingService.asyncWrapper(async (req, res) => {
    const { range = '7d' } = req.query;
    
    const endDate = new Date();
    const startDate = new Date();
    
    switch (range) {
        case '7d':
            startDate.setDate(endDate.getDate() - 7);
            break;
        case '30d':
            startDate.setDate(endDate.getDate() - 30);
            break;
        case '90d':
            startDate.setDate(endDate.getDate() - 90);
            break;
    }

    // Obtener check-ins por día
    const checkinData = await Reservation.aggregate([
        {
            $match: {
                checkIn: { $gte: startDate, $lte: endDate },
                status: { $in: ['confirmed', 'checked-in', 'checked-out'] }
            }
        },
        {
            $group: {
                _id: {
                    $dateToString: { format: "%Y-%m-%d", date: "$checkIn" }
                },
                checkins: { $sum: 1 }
            }
        },
        {
            $sort: { "_id": 1 }
        }
    ]);

    // Obtener check-outs por día
    const checkoutData = await Reservation.aggregate([
        {
            $match: {
                checkOut: { $gte: startDate, $lte: endDate },
                status: 'checked-out'
            }
        },
        {
            $group: {
                _id: {
                    $dateToString: { format: "%Y-%m-%d", date: "$checkOut" }
                },
                checkouts: { $sum: 1 }
            }
        },
        {
            $sort: { "_id": 1 }
        }
    ]);

    // Combinar datos
    const combinedData = {};
    checkinData.forEach(item => {
        combinedData[item._id] = { date: item._id, checkins: item.checkins, checkouts: 0 };
    });
    checkoutData.forEach(item => {
        if (combinedData[item._id]) {
            combinedData[item._id].checkouts = item.checkouts;
        } else {
            combinedData[item._id] = { date: item._id, checkins: 0, checkouts: item.checkouts };
        }
    });

    const result = Object.values(combinedData).sort((a, b) => a.date.localeCompare(b.date));

    res.json(result);
});

// Obtener KPIs principales
exports.getKPIs = ErrorHandlingService.asyncWrapper(async (req, res) => {
    const { range = '7d' } = req.query;
    
    const endDate = new Date();
    const startDate = new Date();
    
    // Período actual
    switch (range) {
        case '7d':
            startDate.setDate(endDate.getDate() - 7);
            break;
        case '30d':
            startDate.setDate(endDate.getDate() - 30);
            break;
        case '90d':
            startDate.setDate(endDate.getDate() - 90);
            break;
    }

    // Período anterior para comparación
    const prevEndDate = new Date(startDate);
    const prevStartDate = new Date(startDate);
    const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    prevStartDate.setDate(prevStartDate.getDate() - daysDiff);

    // Obtener datos del período actual
    const currentReservations = await Reservation.find({
        checkIn: { $gte: startDate, $lte: endDate },
        status: { $in: ['confirmed', 'checked-in', 'checked-out'] }
    });

    // Obtener datos del período anterior
    const prevReservations = await Reservation.find({
        checkIn: { $gte: prevStartDate, $lte: prevEndDate },
        status: { $in: ['confirmed', 'checked-in', 'checked-out'] }
    });

    const totalRooms = await Room.countDocuments();

    // Calcular KPIs actuales
    const currentStats = calculatePeriodStats(currentReservations, totalRooms, daysDiff);
    const prevStats = calculatePeriodStats(prevReservations, totalRooms, daysDiff);

    // Calcular cambios porcentuales
    const kpis = {
        avgOccupancy: currentStats.avgOccupancy,
        occupancyChange: calculatePercentageChange(prevStats.avgOccupancy, currentStats.avgOccupancy),
        
        revpar: currentStats.revpar,
        revparChange: calculatePercentageChange(prevStats.revpar, currentStats.revpar),
        
        adr: currentStats.adr,
        adrChange: calculatePercentageChange(prevStats.adr, currentStats.adr),
        
        totalRevenue: currentStats.totalRevenue,
        revenueChange: calculatePercentageChange(prevStats.totalRevenue, currentStats.totalRevenue),
        
        avgStayLength: currentStats.avgStayLength,
        prevAvgStayLength: prevStats.avgStayLength,
        stayLengthChange: calculatePercentageChange(prevStats.avgStayLength, currentStats.avgStayLength),
        
        cancellationRate: currentStats.cancellationRate,
        prevCancellationRate: prevStats.cancellationRate,
        cancellationChange: calculatePercentageChange(prevStats.cancellationRate, currentStats.cancellationRate),
        
        avgCheckinTime: currentStats.avgCheckinTime,
        prevAvgCheckinTime: prevStats.avgCheckinTime
    };

    res.json(kpis);
});

// Funciones auxiliares
function calculatePeriodStats(reservations, totalRooms, days) {
    const totalRevenue = reservations.reduce((sum, res) => sum + (res.totalPrice || 0), 0);
    const totalRoomNights = reservations.reduce((sum, res) => {
        const nights = Math.ceil((res.checkOut - res.checkIn) / (1000 * 60 * 60 * 24));
        return sum + nights;
    }, 0);
    
    const avgOccupancy = totalRooms > 0 && days > 0 
        ? (totalRoomNights / (totalRooms * days)) * 100 
        : 0;
    
    const adr = totalRoomNights > 0 ? totalRevenue / totalRoomNights : 0;
    const revpar = totalRooms > 0 && days > 0 ? totalRevenue / (totalRooms * days) : 0;
    
    const avgStayLength = reservations.length > 0 
        ? totalRoomNights / reservations.length 
        : 0;

    // Calcular tasa de cancelación (aproximada)
    const cancellationRate = 5; // Placeholder - necesitaríamos un campo de estado 'cancelled'
    
    const avgCheckinTime = "15:30"; // Placeholder - calcular desde datos reales

    return {
        avgOccupancy: Math.round(avgOccupancy * 100) / 100,
        revpar: Math.round(revpar * 100) / 100,
        adr: Math.round(adr * 100) / 100,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        avgStayLength: Math.round(avgStayLength * 100) / 100,
        cancellationRate,
        avgCheckinTime
    };
}

function calculatePercentageChange(oldValue, newValue) {
    if (oldValue === 0) return newValue > 0 ? 100 : 0;
    return Math.round(((newValue - oldValue) / oldValue) * 100 * 100) / 100;
}

module.exports = exports;