// services/mercadoPagoService.js
// Integración completa con Mercado Pago — señas, pagos totales, webhooks
// SDK: mercadopago v2 (https://github.com/mercadopago/sdk-nodejs)

const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const Reservation = require('../models/Reservation');
const { logger } = require('./loggerService');
const auditService = require('./auditService');

// ─── Configuración ────────────────────────────────────────────────────────────
const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
const WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Inicializar cliente solo si el token está configurado
let mpClient = null;
let preferenceClient = null;
let paymentClient = null;

function getMPClient() {
  if (!mpClient) {
    if (!ACCESS_TOKEN) {
      throw new Error('MP_ACCESS_TOKEN no está configurado. Revisa las variables de entorno.');
    }
    mpClient = new MercadoPagoConfig({ accessToken: ACCESS_TOKEN });
    preferenceClient = new Preference(mpClient);
    paymentClient = new Payment(mpClient);
  }
  return { preferenceClient, paymentClient };
}

// ─── Tipos de pago ────────────────────────────────────────────────────────────
const PAYMENT_TYPES = {
  SENA: 'sena',        // Pago parcial / seña (ej: 30%)
  TOTAL: 'total',      // Pago total de la reserva
  SALDO: 'saldo'       // Pago del saldo restante (total - señas ya pagadas)
};

const SENA_PERCENTAGE = 0.30; // 30% de seña por defecto

// ─── Crear preferencia de pago ────────────────────────────────────────────────
/**
 * Crea una preferencia de pago en Mercado Pago.
 * @param {string} reservationId - ID de la reserva en MongoDB
 * @param {'sena'|'total'|'saldo'} paymentType - Tipo de pago
 * @param {Object} options - Opciones adicionales (customAmount, etc.)
 * @returns {Promise<{preferenceId: string, initPoint: string, sandboxInitPoint: string}>}
 */
async function createPaymentPreference(reservationId, paymentType = PAYMENT_TYPES.TOTAL, options = {}) {
  const { preferenceClient } = getMPClient();

  const reservation = await Reservation.findById(reservationId)
    .populate('client', 'nombre apellido email dni telefono')
    .populate('room', 'number type');

  if (!reservation) {
    throw new Error(`Reserva ${reservationId} no encontrada`);
  }
  if (!reservation.pricing?.total) {
    throw new Error('La reserva no tiene pricing calculado');
  }

  const client = reservation.client;
  const total = reservation.pricing.total;
  const amountAlreadyPaid = reservation.payment?.amountPaid || 0;

  // Calcular monto según tipo de pago
  let amount;
  let title;
  switch (paymentType) {
    case PAYMENT_TYPES.SENA:
      amount = options.customAmount || Math.ceil(total * SENA_PERCENTAGE);
      title = `Seña reserva #${String(reservationId).slice(-6).toUpperCase()}`;
      break;
    case PAYMENT_TYPES.SALDO:
      amount = Math.max(0, total - amountAlreadyPaid);
      if (amount === 0) throw new Error('La reserva ya está totalmente pagada');
      title = `Saldo reserva #${String(reservationId).slice(-6).toUpperCase()}`;
      break;
    case PAYMENT_TYPES.TOTAL:
    default:
      amount = total;
      title = `Reserva #${String(reservationId).slice(-6).toUpperCase()} — ${reservation.tipo}`;
      break;
  }

  const externalReference = `${reservationId}|${paymentType}|${Date.now()}`;

  const preferenceData = {
    items: [
      {
        id: String(reservationId),
        title,
        description: `Check-in: ${reservation.checkIn?.toLocaleDateString('es-AR')} — Check-out: ${reservation.checkOut?.toLocaleDateString('es-AR')} — ${reservation.pricing.totalNights} noches`,
        quantity: 1,
        unit_price: amount,
        currency_id: 'ARS'
      }
    ],
    payer: {
      name: client?.nombre || '',
      surname: client?.apellido || '',
      email: client?.email || 'cliente@hotel.com',
      identification: client?.dni
        ? { type: 'DNI', number: String(client.dni) }
        : undefined
    },
    back_urls: {
      success: `${FRONTEND_URL}/reservas/pago/exito?reserva=${reservationId}`,
      failure: `${FRONTEND_URL}/reservas/pago/fallo?reserva=${reservationId}`,
      pending: `${FRONTEND_URL}/reservas/pago/pendiente?reserva=${reservationId}`
    },
    auto_return: 'approved',
    notification_url: `${BACKEND_URL}/api/payments/webhook`,
    external_reference: externalReference,
    metadata: {
      reservation_id: String(reservationId),
      payment_type: paymentType,
      hotel_name: process.env.HOTEL_NAME || 'Hotel'
    },
    statement_descriptor: (process.env.HOTEL_NAME || 'HOTEL').substring(0, 22),
    expires: true,
    expiration_date_to: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() // 48 horas
  };

  const preference = await preferenceClient.create({ body: preferenceData });

  logger.info('Preferencia MercadoPago creada', {
    reservationId,
    preferenceId: preference.id,
    paymentType,
    amount
  });

  return {
    preferenceId: preference.id,
    initPoint: preference.init_point,
    sandboxInitPoint: preference.sandbox_init_point,
    amount,
    externalReference
  };
}

// ─── Verificar firma del webhook ──────────────────────────────────────────────
/**
 * Verifica que el webhook proviene realmente de Mercado Pago.
 * Usa HMAC-SHA256 sobre el body crudo con MP_WEBHOOK_SECRET.
 * @param {string} rawBody - Body crudo como string
 * @param {string} signature - Header x-signature de MP
 * @param {string} requestId - Header x-request-id de MP
 * @returns {boolean}
 */
function verifyWebhookSignature(rawBody, signature, requestId) {
  if (!WEBHOOK_SECRET) {
    logger.warn('MP_WEBHOOK_SECRET no configurado — saltando verificación de firma webhook');
    return true; // En dev sin secret configurado, dejar pasar (loguear siempre)
  }
  if (!signature) return false;

  try {
    const crypto = require('crypto');
    // Formato: ts=<timestamp>,v1=<hash>
    const parts = {};
    signature.split(',').forEach(part => {
      const [key, val] = part.split('=');
      parts[key] = val;
    });

    if (!parts.ts || !parts.v1) return false;

    // Mensaje: id:<request_id>;request-id:<request_id>;ts:<ts>;
    const manifest = `id:${requestId};request-id:${requestId};ts:${parts.ts};`;
    const expectedHash = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(manifest)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(expectedHash, 'hex'),
      Buffer.from(parts.v1, 'hex')
    );
  } catch (err) {
    logger.error('Error verificando firma webhook MP:', err.message);
    return false;
  }
}

// ─── Procesar webhook ─────────────────────────────────────────────────────────
/**
 * Procesa una notificación IPN/webhook de Mercado Pago y actualiza la reserva.
 * @param {Object} data - Payload del webhook
 * @returns {Promise<{processed: boolean, reservationId?: string, status?: string}>}
 */
async function processWebhook(data) {
  const { type, data: eventData } = data;

  if (type !== 'payment') {
    logger.debug('Webhook MP ignorado (no es payment):', { type });
    return { processed: false };
  }

  const paymentId = eventData?.id;
  if (!paymentId) {
    logger.warn('Webhook MP sin payment id');
    return { processed: false };
  }

  // Obtener detalles del pago desde la API de MP
  const { paymentClient } = getMPClient();
  const payment = await paymentClient.get({ id: paymentId });

  logger.info('Webhook MP recibido', {
    paymentId,
    status: payment.status,
    externalReference: payment.external_reference
  });

  if (!payment.external_reference) {
    logger.warn('Pago MP sin external_reference:', { paymentId });
    return { processed: false };
  }

  // Parsear external_reference: reservationId|paymentType|timestamp
  const [reservationId, paymentType] = payment.external_reference.split('|');
  if (!reservationId) {
    logger.warn('external_reference inválido:', { externalReference: payment.external_reference });
    return { processed: false };
  }

  // Mapear estado MP → estado interno
  const mpStatusMap = {
    approved: 'pagado',
    pending: 'pendiente',
    in_process: 'pendiente',
    rejected: 'fallido',
    cancelled: 'cancelado',
    refunded: 'reembolsado',
    charged_back: 'reembolsado'
  };

  const internalStatus = mpStatusMap[payment.status] || 'pendiente';
  const amount = payment.transaction_amount || 0;

  // Actualizar reserva
  const reservation = await Reservation.findById(reservationId);
  if (!reservation) {
    logger.error('Reserva no encontrada para webhook MP:', { reservationId });
    return { processed: false };
  }

  if (payment.status === 'approved') {
    // ─── Idempotencia: si este transactionId ya fue procesado, ignorar ──────
    // MP reintenta el webhook si no recibe 200 a tiempo. Sin esta verificación,
    // se sumaría el monto dos veces y se agregarían entradas duplicadas en paymentHistory.
    const alreadyProcessed = reservation.paymentHistory?.some(
      h => h.transactionId === String(paymentId)
    );
    if (alreadyProcessed) {
      logger.info('Webhook MP ignorado — pago ya procesado (idempotencia)', { paymentId, reservationId });
      return { processed: false, reason: 'already_processed' };
    }

    const newAmountPaid = (reservation.payment?.amountPaid || 0) + amount;
    const total = reservation.pricing?.total || 0;
    const newPaymentStatus = newAmountPaid >= total ? 'pagado' : 'parcial';

    await Reservation.findByIdAndUpdate(reservationId, {
      'payment.status': newPaymentStatus,
      'payment.amountPaid': newAmountPaid,
      'payment.paymentDate': new Date(),
      'payment.transactionId': String(paymentId),
      'payment.method': 'tarjeta', // MP siempre es tarjeta/CBU
      $push: {
        paymentHistory: {
          amount,
          method: 'tarjeta',
          date: new Date(),
          transactionId: String(paymentId),
          notes: `Mercado Pago — ${paymentType} — Estado: ${payment.status}`
        }
      }
    });

    logger.info('Reserva actualizada por pago MP aprobado', {
      reservationId,
      amount,
      newAmountPaid,
      newPaymentStatus,
      paymentType
    });

    auditService.log({
      action: 'PAYMENT_MP_APPROVED',
      entity: 'Reservation',
      entityId: reservationId,
      userEmail: 'sistema',
      userRole: 'sistema',
      description: `Pago MP aprobado. Monto: $${amount}. Total pagado: $${newAmountPaid}`,
      metadata: { paymentId, paymentType, status: payment.status }
    });

    // Email recibo de pago — no bloquea el procesamiento del webhook
    setImmediate(async () => {
      try {
        const emailService = require('./emailService');
        const populated = await Reservation.findById(reservationId).populate('client', 'nombre apellido email');
        if (populated?.client?.email) {
          await emailService.sendPaymentReceipt({
            reservation: populated,
            client: populated.client,
            payment: { amount, method: 'tarjeta', transactionId: String(paymentId), date: new Date() }
          });
        }
      } catch (e) {
        logger.warn('Error enviando email recibo pago MP:', e.message);
      }
    });

  } else if (['refunded', 'charged_back'].includes(payment.status)) {
    const oldAmountPaid = reservation.payment?.amountPaid || 0;
    const newAmountPaid = Math.max(0, oldAmountPaid - amount);
    const newPaymentStatus = newAmountPaid <= 0 ? 'pendiente' : 'reembolsado';

    await Reservation.findByIdAndUpdate(reservationId, {
      'payment.status': newPaymentStatus,
      'payment.amountPaid': newAmountPaid,
      'payment.transactionId': String(paymentId),
      'payment.method': 'tarjeta',
      $push: {
        paymentHistory: {
          amount: -amount,
          method: 'tarjeta',
          date: new Date(),
          transactionId: String(paymentId),
          status: 'reembolsado',
          notes: `Mercado Pago — ${paymentType} — Estado: ${payment.status}`
        }
      }
    });

    logger.warn('Reserva actualizada por reembolso/contracargo MP', {
      reservationId,
      amount,
      oldAmountPaid,
      newAmountPaid,
      paymentType,
      status: payment.status
    });

    auditService.log({
      action: 'PAYMENT_MP_REFUNDED',
      entity: 'Reservation',
      entityId: reservationId,
      userEmail: 'sistema',
      userRole: 'sistema',
      description: `Pago MP reembolsado/contracargo. Monto: $${amount}. Total pagado: $${newAmountPaid}`,
      metadata: { paymentId, paymentType, status: payment.status }
    });

  } else if (['rejected', 'cancelled'].includes(payment.status)) {
    logger.warn('Pago MP rechazado/cancelado', { reservationId, paymentId, status: payment.status });
    auditService.log({
      action: 'PAYMENT_MP_FAILED',
      entity: 'Reservation',
      entityId: reservationId,
      userEmail: 'sistema',
      userRole: 'sistema',
      description: `Pago MP ${payment.status}. ID: ${paymentId}`,
      metadata: { paymentId, paymentType, status: payment.status }
    });
  }

  return {
    processed: true,
    reservationId,
    paymentId: String(paymentId),
    status: internalStatus,
    amount
  };
}

// ─── Consultar estado de un pago ──────────────────────────────────────────────
async function getPaymentStatus(paymentId) {
  const { paymentClient } = getMPClient();
  const payment = await paymentClient.get({ id: paymentId });
  return {
    id: payment.id,
    status: payment.status,
    statusDetail: payment.status_detail,
    amount: payment.transaction_amount,
    dateApproved: payment.date_approved,
    externalReference: payment.external_reference
  };
}

module.exports = {
  createPaymentPreference,
  processWebhook,
  verifyWebhookSignature,
  getPaymentStatus,
  PAYMENT_TYPES,
  SENA_PERCENTAGE
};
