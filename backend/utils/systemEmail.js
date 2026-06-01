const nodemailer = require('nodemailer');

function getTransporter() {
  if (!process.env.SYSTEM_SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SYSTEM_SMTP_HOST,
    port: parseInt(process.env.SYSTEM_SMTP_PORT) || 587,
    secure: parseInt(process.env.SYSTEM_SMTP_PORT) === 465,
    auth: {
      user: process.env.SYSTEM_SMTP_USER,
      pass: process.env.SYSTEM_SMTP_PASS,
    },
  });
}

async function sendSystemEmail({ to, subject, html }) {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn('[SystemEmail] SYSTEM_SMTP_HOST non configuré — ignoré:', subject, '→', to);
    return null;
  }
  const fromName = process.env.SYSTEM_FROM_NAME || 'SecuritySaaS';
  const fromEmail = process.env.SYSTEM_FROM_EMAIL || process.env.SYSTEM_SMTP_USER;
  try {
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      html,
    });
    console.log('[SystemEmail] Envoyé:', subject, '→', to);
    return info;
  } catch (e) {
    console.error('[SystemEmail] Erreur:', e.message);
    // Ne pas planter l'app pour un email raté
    return null;
  }
}

module.exports = { sendSystemEmail };
