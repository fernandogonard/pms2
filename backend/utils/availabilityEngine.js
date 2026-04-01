const Reservation = require('../models/Reservation');

class AvailabilityEngine {
  static async getRoomStatus(roomId, startDate, endDate) {
    const reservations = await Reservation.find({
      roomId,
      status: { $in: ['reservada', 'checkin'] },
      checkOut: { $gt: startDate },
      checkIn: { $lt: endDate }
    }).lean();

    // Lógica determinística para estado
    const days = [];
    for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
      const dayReservations = reservations.filter(r =>
        r.checkIn <= d && r.checkOut > d
      );
      days.push({
        date: d.toISOString().slice(0, 10),
        status: dayReservations.length > 0 ? 'ocupada' : 'libre',
        reservation: dayReservations[0] || null
      });
    }
    return days;
  }
}

module.exports = AvailabilityEngine;
