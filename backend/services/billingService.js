// services/billingService.js
// Servicio para cálculos de facturación y precios

const RoomType = require('../models/RoomType');
const Reservation = require('../models/Reservation');
const Room = require('../models/Room');

class BillingService {
  
  /**
   * Calcular precio total de una reserva
   */
  static async calculateReservationPricing(reservationData) {
    try {
      const { tipo, cantidad, checkIn, checkOut } = reservationData;
      
      // Obtener precio base por tipo de habitación
      let roomType = await RoomType.findOne({ name: tipo, isActive: true });
      
      // Fallback: si no hay RoomType seedeado, usar el precio de la colección Room
      if (!roomType) {
        const roomSample = await Room.findOne({ type: tipo });
        if (!roomSample) {
          throw new Error(`Tipo de habitación '${tipo}' no encontrado en el sistema`);
        }
        const CAPACITY_MAP = { doble: 2, triple: 3, cuadruple: 4, suite: 2 };
        roomType = {
          basePrice: roomSample.price,
          currency: 'ARS',
          capacity: CAPACITY_MAP[tipo] || 2,
          name: tipo,
          description: ''
        };
      }
      
      // Calcular noches
      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkOut);
      const diffTime = Math.abs(checkOutDate - checkInDate);
      const totalNights = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
      
      // Calcular precios
      const pricePerNight = roomType.basePrice;
      const subtotal = pricePerNight * totalNights * cantidad;
      const taxes = Math.round(subtotal * 0.21 * 100) / 100; // IVA 21% redondeado
      const total = subtotal + taxes;
      
      return {
        pricePerNight,
        totalNights,
        subtotal,
        taxes,
        total,
        currency: roomType.currency,
        roomType: {
          name: roomType.name,
          capacity: roomType.capacity,
          description: roomType.description
        }
      };
      
    } catch (error) {
      console.error('Error calculando precios de reserva:', error);
      throw error;
    }
  }
  
  /**
   * Actualizar precios de una reserva existente
   */
  static async updateReservationPricing(reservationId) {
    try {
      const reservation = await Reservation.findById(reservationId);
      if (!reservation) {
        throw new Error('Reserva no encontrada');
      }
      
      const pricing = await this.calculateReservationPricing({
        tipo: reservation.tipo,
        cantidad: reservation.cantidad,
        checkIn: reservation.checkIn,
        checkOut: reservation.checkOut
      });
      
      reservation.pricing = pricing;
      await reservation.save();
      
      return reservation;
      
    } catch (error) {
      console.error('Error actualizando precios de reserva:', error);
      throw error;
    }
  }
  
  /**
   * Generar número de factura único
   */
  static generateInvoiceNumber() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    
    return `INV-${year}${month}${day}${hour}${minute}-${random}`;
  }
  
  /**
   * Procesar pago de reserva
   */
  static async processPayment(reservationId, paymentData) {
    try {
      const { amount, method, transactionId, notes } = paymentData;
      
      const reservation = await Reservation.findById(reservationId);
      if (!reservation) {
        throw new Error('Reserva no encontrada');
      }
      
      // Validar monto
      if (amount <= 0) {
        throw new Error('El monto debe ser mayor a 0');
      }

      // Guard: si pricing.total es 0 o no está calculado, calcularlo ahora
      if (!reservation.pricing || !reservation.pricing.total) {
        try {
          const pricing = await this.calculateReservationPricing({
            tipo: reservation.tipo,
            cantidad: reservation.cantidad,
            checkIn: reservation.checkIn,
            checkOut: reservation.checkOut
          });
          reservation.pricing = pricing;
          // Aplicar también extras ya cargados
          if (reservation.extras && reservation.extras.length > 0) {
            const extrasTotal = reservation.extras.reduce((s, e) => s + (e.amount || 0), 0);
            reservation.pricing.total = pricing.total + extrasTotal;
          }
          await reservation.save();
        } catch (pricingErr) {
          throw new Error(`No se pudo calcular el precio de la reserva: ${pricingErr.message}`);
        }
      }

      const remainingAmount = reservation.pricing.total - reservation.payment.amountPaid;
      if (amount > remainingAmount + 0.01) {
        throw new Error(`El monto excede el saldo pendiente de $${Math.round(remainingAmount)}`);
      }
      
      // Registrar en historial de pagos
      if (!reservation.paymentHistory) reservation.paymentHistory = [];
      reservation.paymentHistory.push({
        amount,
        method,
        date: new Date(),
        transactionId: transactionId || null,
        notes: notes || ''
      });

      // Actualizar resumen de pago
      reservation.payment.amountPaid += amount;
      reservation.payment.method = method;
      reservation.payment.paymentDate = new Date();
      if (transactionId) reservation.payment.transactionId = transactionId;
      if (notes) reservation.payment.notes = notes;
      
      // Actualizar estado de pago
      if (reservation.payment.amountPaid >= reservation.pricing.total - 0.01) {
        reservation.payment.status = 'pagado';
        reservation.invoice.isPaid = true;
      } else if (reservation.payment.amountPaid > 0) {
        reservation.payment.status = 'parcial';
      }
      
      // Generar factura si no existe
      if (!reservation.invoice.number) {
        reservation.invoice.number = this.generateInvoiceNumber();
        reservation.invoice.issueDate = new Date();
        reservation.invoice.dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      }
      
      await reservation.save();
      
      return {
        success: true,
        reservation,
        payment: {
          amountPaid: amount,
          totalPaid: reservation.payment.amountPaid,
          remaining: Math.max(0, reservation.pricing.total - reservation.payment.amountPaid),
          status: reservation.payment.status,
          history: reservation.paymentHistory
        }
      };
      
    } catch (error) {
      console.error('Error procesando pago:', error);
      throw error;
    }
  }

  /**
   * Agregar cargo extra a una reserva en curso
   */
  static async addCharge(reservationId, chargeData) {
    try {
      const { description, amount, category } = chargeData;

      const reservation = await Reservation.findById(reservationId)
        .populate('client', 'nombre apellido');
      if (!reservation) throw new Error('Reserva no encontrada');
      if (!['reservada', 'checkin'].includes(reservation.status)) {
        throw new Error('Solo se pueden agregar cargos a reservas activas o en check-in');
      }
      if (!amount || amount <= 0) throw new Error('El monto debe ser mayor a 0');

      if (!reservation.extras) reservation.extras = [];
      reservation.extras.push({
        description,
        amount,
        category: category || 'otro',
        date: new Date()
      });

      // Recalcular total sumando extras
      const extrasTotal = reservation.extras.reduce((sum, e) => sum + e.amount, 0);
      if (reservation.pricing) {
        const subtotal = reservation.pricing.subtotal || 0;
        const taxes = reservation.pricing.taxes || 0;
        reservation.pricing.extrasTotal = extrasTotal;
        reservation.pricing.total = subtotal + taxes + extrasTotal;
      }

      // Actualizar estado de pago si el nuevo total cambia el saldo
      const totalPaid = reservation.payment.amountPaid || 0;
      const newTotal = reservation.pricing.total;
      if (totalPaid >= newTotal) {
        reservation.payment.status = 'pagado';
      } else if (totalPaid > 0) {
        reservation.payment.status = 'parcial';
      } else {
        reservation.payment.status = 'pendiente';
      }

      await reservation.save();
      return {
        success: true,
        extras: reservation.extras,
        pricing: reservation.pricing,
        paymentStatus: reservation.payment.status
      };
    } catch (error) {
      console.error('Error agregando cargo:', error);
      throw error;
    }
  }
  
  /**
   * Obtener resumen financiero por período
   */
  static async getFinancialSummary(startDate, endDate) {
    try {
      const reservations = await Reservation.find({
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        },
        'pricing.total': { $exists: true }
      }).populate('client', 'nombre apellido email');
      
      const summary = {
        totalReservations: reservations.length,
        totalRevenue: 0,
        totalPaid: 0,
        totalPending: 0,
        averageReservationValue: 0,
        paymentMethods: {},
        reservationsByStatus: {},
        currency: 'ARS'
      };
      
      reservations.forEach(reservation => {
        // Revenue totals
        summary.totalRevenue += reservation.pricing.total;
        summary.totalPaid += reservation.payment.amountPaid;
        summary.totalPending += (reservation.pricing.total - reservation.payment.amountPaid);
        
        // Payment methods
        if (reservation.payment.method) {
          summary.paymentMethods[reservation.payment.method] = 
            (summary.paymentMethods[reservation.payment.method] || 0) + reservation.payment.amountPaid;
        }
        
        // Reservation status
        summary.reservationsByStatus[reservation.status] = 
          (summary.reservationsByStatus[reservation.status] || 0) + 1;
      });
      
      summary.averageReservationValue = summary.totalReservations > 0 
        ? Math.round(summary.totalRevenue / summary.totalReservations)
        : 0;
      
      return summary;
      
    } catch (error) {
      console.error('Error generando resumen financiero:', error);
      throw error;
    }
  }
  
  /**
   * Obtener facturas pendientes
   */
  static async getPendingInvoices() {
    try {
      const pendingInvoices = await Reservation.find({
        'invoice.isPaid': false,
        'invoice.number': { $exists: true, $ne: null },
        status: { $ne: 'cancelada' }
      }).populate('client', 'nombre apellido email telefono')
        .sort({ 'invoice.dueDate': 1 });
      
      return pendingInvoices.map(reservation => ({
        id: reservation._id,
        invoiceNumber: reservation.invoice.number,
        client: {
          name: `${reservation.client.nombre} ${reservation.client.apellido}`,
          email: reservation.client.email,
          phone: reservation.client.telefono
        },
        amount: reservation.pricing.total,
        amountPaid: reservation.payment.amountPaid,
        pending: reservation.pricing.total - reservation.payment.amountPaid,
        issueDate: reservation.invoice.issueDate,
        dueDate: reservation.invoice.dueDate,
        overdue: new Date() > new Date(reservation.invoice.dueDate),
        paymentStatus: reservation.payment.status
      }));
      
    } catch (error) {
      console.error('Error obteniendo facturas pendientes:', error);
      throw error;
    }
  }
}

module.exports = BillingService;