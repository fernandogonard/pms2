// controllers/paymentController.js
// Controlador para pagos con Mercado Pago

const mercadoPagoService = require('../services/mercadoPagoService');
const { logger } = require('../services/loggerService');

/**
 * POST /api/payments/preference
 * Crea una preferencia de pago para una reserva.
 * Body: { reservationId, paymentType: 'sena'|'total'|'saldo', customAmount? }
 */
const createPreference = async (req, res) => {
  try {
    const { reservationId, paymentType = 'total', customAmount } = req.body;

    if (!reservationId) {
      return res.status(400).json({ success: false, message: 'reservationId es requerido' });
    }

    const validTypes = ['sena', 'total', 'saldo'];
    if (!validTypes.includes(paymentType)) {
      return res.status(400).json({
        success: false,
        message: `paymentType inválido. Valores válidos: ${validTypes.join(', ')}`
      });
    }

    const result = await mercadoPagoService.createPaymentPreference(
      reservationId,
      paymentType,
      { customAmount: customAmount ? Number(customAmount) : undefined }
    );

    res.json({
      success: true,
      data: {
        preferenceId: result.preferenceId,
        initPoint: result.initPoint,
        sandboxInitPoint: result.sandboxInitPoint,
        amount: result.amount
      }
    });
  } catch (err) {
    logger.error('Error creando preferencia MP:', { error: err.message, user: req.user?.id });
    const status = err.message.includes('no encontrada') ? 404 : 500;
    res.status(status).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/payments/webhook
 * Recibe notificaciones IPN de Mercado Pago.
 * IMPORTANTE: Esta ruta NO debe llevar middleware de autenticación JWT.
 * La verificación se hace por firma HMAC del webhook.
 */
const handleWebhook = async (req, res) => {
  try {
    // Verificar firma del webhook
    const signature = req.headers['x-signature'];
    const requestId = req.headers['x-request-id'];
    const rawBody = req.rawBody || JSON.stringify(req.body);

    const isValid = mercadoPagoService.verifyWebhookSignature(rawBody, signature, requestId);
    if (!isValid) {
      logger.warn('Webhook MP con firma inválida', {
        ip: req.ip,
        signature: signature?.substring(0, 20)
      });
      return res.status(401).json({ success: false, message: 'Firma inválida' });
    }

    // Responder rápido a MP (requieren 200 en < 5s)
    res.status(200).json({ received: true });

    // Procesar en background
    setImmediate(async () => {
      try {
        const result = await mercadoPagoService.processWebhook(req.body);
        if (result.processed) {
          logger.info('Webhook MP procesado', result);
        }
      } catch (err) {
        logger.error('Error procesando webhook MP en background:', { error: err.message });
      }
    });
  } catch (err) {
    logger.error('Error en handler webhook MP:', { error: err.message });
    // No exponer detalles de error al exterior
    res.status(500).json({ success: false, message: 'Error interno' });
  }
};

/**
 * GET /api/payments/status/:paymentId
 * Consulta el estado de un pago específico.
 */
const getPaymentStatus = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const status = await mercadoPagoService.getPaymentStatus(paymentId);
    res.json({ success: true, data: status });
  } catch (err) {
    logger.error('Error consultando estado pago MP:', { error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { createPreference, handleWebhook, getPaymentStatus };
