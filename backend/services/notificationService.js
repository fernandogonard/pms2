// services/notificationService.js
// Servicio de notificaciones al huésped vía WhatsApp (wa.me links)
// No requiere API key — genera links que el staff puede enviar con un click.
// Para envío automático real: configurar TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_WHATSAPP_FROM en .env

/**
 * Normaliza un número de teléfono al formato internacional argentino (+54...)
 * Acepta: "1145678901", "01145678901", "+541145678901", "541145678901"
 */
function normalizePhone(raw) {
  if (!raw) return null;
  let n = String(raw).replace(/\D/g, ''); // solo dígitos
  // Ya tiene código de país
  if (n.startsWith('549') && n.length >= 12) return n;
  if (n.startsWith('54') && n.length >= 11) return n;
  // Tiene 0 adelante (ej: 011...)
  if (n.startsWith('0')) n = n.slice(1);
  // Celular argentino sin 9 (ej: 1145678901 → 541145678901)
  return '54' + n;
}

/**
 * Genera el texto del mensaje de confirmación de reserva
 */
function buildConfirmationMessage({ reservation, client, hotelName = 'MiHotel' }) {
  const checkIn  = reservation.checkIn  ? new Date(reservation.checkIn).toLocaleDateString('es-AR')  : '-';
  const checkOut = reservation.checkOut ? new Date(reservation.checkOut).toLocaleDateString('es-AR') : '-';
  const tipo     = (reservation.tipo || '').toUpperCase();
  const cantidad = reservation.cantidad || 1;
  const nights   = reservation.pricing?.totalNights || '-';
  const total    = reservation.pricing?.total
    ? `$${reservation.pricing.total.toLocaleString('es-AR')}`
    : 'a confirmar';
  const ref      = reservation._id ? String(reservation._id).slice(-6).toUpperCase() : '------';
  const nombre   = client?.nombre || 'Huésped';

  return (
    `🏨 *${hotelName}* — Confirmación de reserva\n\n` +
    `Hola *${nombre}*, tu reserva fue registrada correctamente ✅\n\n` +
    `📋 *Referencia:* #${ref}\n` +
    `🛏️ *Tipo:* ${tipo} (${cantidad} hab.)\n` +
    `📅 *Check-in:*  ${checkIn}\n` +
    `📅 *Check-out:* ${checkOut}\n` +
    `🌙 *Noches:* ${nights}\n` +
    `💰 *Total:* ${total}\n\n` +
    `Si necesitás hacer algún cambio respondé este mensaje. ¡Te esperamos!`
  );
}

/**
 * Genera el texto del mensaje de recordatorio pre-checkin (enviar 1 día antes)
 */
function buildCheckinReminderMessage({ reservation, client, hotelName = 'MiHotel' }) {
  const checkIn = reservation.checkIn ? new Date(reservation.checkIn).toLocaleDateString('es-AR') : '-';
  const nombre  = client?.nombre || 'Huésped';
  const ref     = reservation._id ? String(reservation._id).slice(-6).toUpperCase() : '------';
  return (
    `🏨 *${hotelName}* — Recordatorio de llegada\n\n` +
    `Hola *${nombre}*, te recordamos que mañana *${checkIn}* tenés check-in con nosotros 🎉\n\n` +
    `📋 *Referencia:* #${ref}\n` +
    `🕐 Check-in a partir de las *14:00 hs*\n` +
    `📍 Si necesitás indicaciones o llegás antes, avisanos por este mensaje.\n\n` +
    `¡Nos vemos mañana!`
  );
}

/**
 * Genera el texto del mensaje de agradecimiento post-checkout
 */
function buildCheckoutMessage({ reservation, client, hotelName = 'MiHotel' }) {
  const nombre = client?.nombre || 'Huésped';
  return (
    `🏨 *${hotelName}* — ¡Hasta pronto!\n\n` +
    `Gracias *${nombre}* por elegirnos. Fue un placer tenerte con nosotros 🙏\n\n` +
    `Si querés dejarnos una reseña o tenés algún comentario, respondé este mensaje.\n\n` +
    `¡Te esperamos en tu próxima visita! ✨`
  );
}

/**
 * Genera un link wa.me listo para abrir WhatsApp Web / App
 * @param {string} phone - número (se normaliza automáticamente)
 * @param {string} message - texto del mensaje
 * @returns {string|null}
 */
function getWhatsAppLink(phone, message) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

/**
 * Genera todos los links útiles para una reserva de una vez
 */
function getReservationLinks({ reservation, client, hotelName }) {
  const phone = client?.whatsapp || client?.phone;
  if (!phone) return { confirmation: null, reminder: null, checkout: null };

  return {
    confirmation: getWhatsAppLink(phone, buildConfirmationMessage({ reservation, client, hotelName })),
    reminder:     getWhatsAppLink(phone, buildCheckinReminderMessage({ reservation, client, hotelName })),
    checkout:     getWhatsAppLink(phone, buildCheckoutMessage({ reservation, client, hotelName })),
  };
}

// ── Envío real vía Twilio (opcional, requiere config) ────────────────────────
// Para activar: npm install twilio
// Variables .env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM
async function sendWhatsAppTwilio(to, message) {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.log('[NotificationService] Twilio no configurado — usando links manuales');
    return { success: false, reason: 'twilio_not_configured' };
  }
  try {
    const twilio = require('twilio');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const from   = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';
    const normalized = normalizePhone(to);
    const result = await client.messages.create({
      from,
      to: `whatsapp:+${normalized}`,
      body: message,
    });
    return { success: true, sid: result.sid };
  } catch (err) {
    console.error('[NotificationService] Error Twilio:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  normalizePhone,
  buildConfirmationMessage,
  buildCheckinReminderMessage,
  buildCheckoutMessage,
  getWhatsAppLink,
  getReservationLinks,
  sendWhatsAppTwilio,
};
