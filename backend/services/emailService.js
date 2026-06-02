// services/emailService.js
// Servicio de emails transaccionales — Nodemailer con plantillas HTML
// Soporta: confirmación de reserva, recuperación de contraseña, recordatorios check-in/out, comprobantes

const nodemailer = require('nodemailer');
const { logger } = require('./loggerService');

// ─── Configuración del transporter ───────────────────────────────────────────
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.EMAIL_HOST;
  const port = parseInt(process.env.EMAIL_PORT || '587', 10);
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  const secure = process.env.EMAIL_SECURE === 'true';

  if (!host || !user || !pass) {
    logger.warn('EMAIL_HOST/EMAIL_USER/EMAIL_PASS no configurados — emails deshabilitados');
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: { rejectUnauthorized: process.env.NODE_ENV === 'production' }
  });

  return transporter;
}

const FROM = process.env.EMAIL_FROM || `"Hotel" <noreply@hotel.com>`;
const HOTEL_NAME = process.env.HOTEL_NAME || 'Hotel';
const HOTEL_ADDRESS = process.env.HOTEL_ADDRESS || '';
const HOTEL_PHONE = process.env.HOTEL_PHONE || '';
const HOTEL_EMAIL_CONTACT = process.env.HOTEL_EMAIL || '';

// ─── Enviar email ─────────────────────────────────────────────────────────────
async function sendEmail({ to, subject, html, text }) {
  const t = getTransporter();
  if (!t) {
    logger.warn('Email no enviado (transporter no configurado):', { to, subject });
    return { sent: false, reason: 'transporter_not_configured' };
  }

  try {
    const info = await t.sendMail({ from: FROM, to, subject, html, text });
    logger.info('Email enviado', { to, subject, messageId: info.messageId });
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    logger.error('Error enviando email:', { to, subject, error: err.message });
    return { sent: false, error: err.message };
  }
}

// ─── Helper para formatear fechas ─────────────────────────────────────────────
function formatDate(date) {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('es-AR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

function formatCurrency(amount) {
  if (amount === undefined || amount === null) return '-';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);
}

// ─── Layout base HTML ─────────────────────────────────────────────────────────
function baseLayout(content, title) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background: #f5f5f5; font-family: Arial, sans-serif; }
    .container { max-width: 600px; margin: 24px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,.1); }
    .header { background: #1a202c; color: #fff; padding: 28px 32px; text-align: center; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 1px; }
    .header p { margin: 4px 0 0; font-size: 13px; opacity: .75; }
    .body { padding: 32px; color: #333; }
    .body h2 { color: #1a202c; font-size: 18px; margin: 0 0 16px; }
    .info-box { background: #f9f9f9; border-left: 4px solid #d4aa70; border-radius: 4px; padding: 16px 20px; margin: 20px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #eee; font-size: 14px; }
    .info-row:last-child { border-bottom: none; }
    .info-row .label { color: #777; }
    .info-row .value { font-weight: 600; color: #1a202c; }
    .badge { display: inline-block; background: #d4aa70; color: #1a202c; font-weight: 700; padding: 4px 12px; border-radius: 99px; font-size: 13px; }
    .btn { display: inline-block; background: #d4aa70; color: #1a202c !important; font-weight: 700; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-size: 15px; margin: 16px 0; }
    .footer { background: #1a202c; color: #aaa; padding: 20px 32px; font-size: 12px; text-align: center; line-height: 1.7; }
    .footer a { color: #d4aa70; text-decoration: none; }
    p { line-height: 1.7; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🏨 ${HOTEL_NAME}</h1>
      <p>${HOTEL_ADDRESS}</p>
    </div>
    <div class="body">
      ${content}
    </div>
    <div class="footer">
      <p>${HOTEL_NAME} · ${HOTEL_ADDRESS}<br>
      ${HOTEL_PHONE ? `Tel: ${HOTEL_PHONE} · ` : ''}${HOTEL_EMAIL_CONTACT ? `<a href="mailto:${HOTEL_EMAIL_CONTACT}">${HOTEL_EMAIL_CONTACT}</a>` : ''}</p>
      <p style="color:#666; font-size:11px">Este es un mensaje automático, no respondas a este email.</p>
    </div>
  </div>
</body>
</html>`;
}

// ─── 1. Confirmación de reserva ───────────────────────────────────────────────
async function sendReservationConfirmation({ reservation, client }) {
  if (!client?.email) return { sent: false, reason: 'no_email' };

  const ref = String(reservation._id).slice(-6).toUpperCase();
  const roomInfo = Array.isArray(reservation.room) && reservation.room.length > 0
    ? reservation.room.map(r => `Hab. ${r.number || r}`).join(', ')
    : 'Por asignar';

  const content = `
    <h2>¡Reserva confirmada! ✅</h2>
    <p>Hola <strong>${client.nombre} ${client.apellido || ''}</strong>,</p>
    <p>Tu reserva en <strong>${HOTEL_NAME}</strong> fue registrada correctamente.</p>
    <div class="info-box">
      <div class="info-row"><span class="label">Referencia</span><span class="value"><span class="badge">#${ref}</span></span></div>
      <div class="info-row"><span class="label">Tipo de habitación</span><span class="value">${(reservation.tipo || '').toUpperCase()}</span></div>
      <div class="info-row"><span class="label">Habitación</span><span class="value">${roomInfo}</span></div>
      <div class="info-row"><span class="label">Check-in</span><span class="value">${formatDate(reservation.checkIn)}</span></div>
      <div class="info-row"><span class="label">Check-out</span><span class="value">${formatDate(reservation.checkOut)}</span></div>
      <div class="info-row"><span class="label">Noches</span><span class="value">${reservation.pricing?.totalNights || '-'}</span></div>
      <div class="info-row"><span class="label">Total</span><span class="value">${formatCurrency(reservation.pricing?.total)}</span></div>
      <div class="info-row"><span class="label">Estado de pago</span><span class="value">${reservation.payment?.status || 'pendiente'}</span></div>
    </div>
    <p>El check-in es a partir de las <strong>14:00 hs</strong>. Si necesitás hacer algún cambio, comunicate con nosotros.</p>
    <p>¡Te esperamos!</p>
  `;

  return sendEmail({
    to: client.email,
    subject: `✅ Reserva confirmada #${ref} — ${HOTEL_NAME}`,
    html: baseLayout(content, `Confirmación de reserva #${ref}`),
    text: `Reserva #${ref} confirmada. Check-in: ${formatDate(reservation.checkIn)}. Check-out: ${formatDate(reservation.checkOut)}. Total: ${formatCurrency(reservation.pricing?.total)}`
  });
}

// ─── 2. Recordatorio de check-in ─────────────────────────────────────────────
async function sendCheckinReminder({ reservation, client }) {
  if (!client?.email) return { sent: false, reason: 'no_email' };

  const ref = String(reservation._id).slice(-6).toUpperCase();
  const content = `
    <h2>¡Mañana es tu llegada! 🎉</h2>
    <p>Hola <strong>${client.nombre}</strong>,</p>
    <p>Te recordamos que <strong>mañana</strong> tenés check-in en <strong>${HOTEL_NAME}</strong>.</p>
    <div class="info-box">
      <div class="info-row"><span class="label">Referencia</span><span class="value"><span class="badge">#${ref}</span></span></div>
      <div class="info-row"><span class="label">Fecha de llegada</span><span class="value">${formatDate(reservation.checkIn)}</span></div>
      <div class="info-row"><span class="label">Horario de check-in</span><span class="value">A partir de las 14:00 hs</span></div>
      <div class="info-row"><span class="label">Check-out</span><span class="value">${formatDate(reservation.checkOut)}</span></div>
    </div>
    <p>Si llegás antes o necesitás guardar equipaje, podés contactarnos.</p>
    <p>¡Nos vemos mañana! 🤗</p>
  `;

  return sendEmail({
    to: client.email,
    subject: `📅 Recordatorio: mañana es tu check-in — ${HOTEL_NAME}`,
    html: baseLayout(content, `Recordatorio de check-in #${ref}`),
    text: `Recordatorio: mañana es tu check-in en ${HOTEL_NAME}. Referencia #${ref}. Check-in a partir de las 14:00 hs.`
  });
}

// ─── 3. Confirmación de check-out / Agradecimiento ───────────────────────────
async function sendCheckoutThankYou({ reservation, client }) {
  if (!client?.email) return { sent: false, reason: 'no_email' };

  const ref = String(reservation._id).slice(-6).toUpperCase();
  const content = `
    <h2>¡Hasta pronto! 👋</h2>
    <p>Hola <strong>${client.nombre}</strong>,</p>
    <p>Gracias por elegirnos. Fue un placer tenerte en <strong>${HOTEL_NAME}</strong>.</p>
    <div class="info-box">
      <div class="info-row"><span class="label">Referencia</span><span class="value"><span class="badge">#${ref}</span></span></div>
      <div class="info-row"><span class="label">Total facturado</span><span class="value">${formatCurrency(reservation.pricing?.total)}</span></div>
    </div>
    <p>Si querés dejarnos una reseña o tenés algún comentario sobre tu estadía, nos encantaría escucharte.</p>
    <p>¡Esperamos verte pronto! ✨</p>
  `;

  return sendEmail({
    to: client.email,
    subject: `🙏 ¡Gracias por tu visita! — ${HOTEL_NAME}`,
    html: baseLayout(content, `Gracias por tu visita — ${HOTEL_NAME}`),
    text: `Gracias por elegirnos, ${client.nombre}. Fue un placer tenerte en ${HOTEL_NAME}. Referencia #${ref}.`
  });
}

// ─── 4. Recuperación de contraseña ───────────────────────────────────────────
async function sendPasswordReset({ email, resetToken, resetUrl }) {
  const content = `
    <h2>Recuperar contraseña 🔐</h2>
    <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>${HOTEL_NAME}</strong>.</p>
    <p>Hacé click en el botón para crear una nueva contraseña:</p>
    <p style="text-align:center"><a href="${resetUrl}" class="btn">Restablecer contraseña</a></p>
    <p>O copiá este enlace en tu navegador:</p>
    <p style="word-break:break-all; font-size:12px; color:#888">${resetUrl}</p>
    <p><strong>Este enlace expira en 1 hora.</strong></p>
    <p>Si no solicitaste este cambio, ignorá este email. Tu contraseña no será modificada.</p>
  `;

  return sendEmail({
    to: email,
    subject: `🔐 Recuperar contraseña — ${HOTEL_NAME}`,
    html: baseLayout(content, `Recuperar contraseña — ${HOTEL_NAME}`),
    text: `Para restablecer tu contraseña, visitá: ${resetUrl} (expira en 1 hora).`
  });
}

// ─── 5. Comprobante de pago ───────────────────────────────────────────────────
async function sendPaymentReceipt({ reservation, client, payment }) {
  if (!client?.email) return { sent: false, reason: 'no_email' };

  const ref = String(reservation._id).slice(-6).toUpperCase();
  const content = `
    <h2>Comprobante de pago 🧾</h2>
    <p>Hola <strong>${client.nombre}</strong>,</p>
    <p>Confirmamos la recepción de tu pago para la reserva <strong>#${ref}</strong>.</p>
    <div class="info-box">
      <div class="info-row"><span class="label">Monto pagado</span><span class="value">${formatCurrency(payment.amount)}</span></div>
      <div class="info-row"><span class="label">Fecha</span><span class="value">${formatDate(payment.date || new Date())}</span></div>
      <div class="info-row"><span class="label">Método</span><span class="value">${payment.method || '-'}</span></div>
      <div class="info-row"><span class="label">Total reserva</span><span class="value">${formatCurrency(reservation.pricing?.total)}</span></div>
      <div class="info-row"><span class="label">Total abonado</span><span class="value">${formatCurrency(reservation.payment?.amountPaid)}</span></div>
      <div class="info-row"><span class="label">Saldo pendiente</span><span class="value">${formatCurrency(Math.max(0, (reservation.pricing?.total || 0) - (reservation.payment?.amountPaid || 0)))}</span></div>
    </div>
  `;

  return sendEmail({
    to: client.email,
    subject: `🧾 Comprobante de pago #${ref} — ${HOTEL_NAME}`,
    html: baseLayout(content, `Comprobante de pago #${ref}`),
    text: `Pago recibido. Reserva #${ref}. Monto: ${formatCurrency(payment.amount)}.`
  });
}

// ─── Verificar configuración ──────────────────────────────────────────────────
async function verifyConnection() {
  const t = getTransporter();
  if (!t) return { ok: false, reason: 'not_configured' };
  try {
    await t.verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = {
  sendReservationConfirmation,
  sendCheckinReminder,
  sendCheckoutThankYou,
  sendPasswordReset,
  sendPaymentReceipt,
  verifyConnection
};
