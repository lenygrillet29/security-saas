const nodemailer = require('nodemailer');

const FROM_NAME  = process.env.SYSTEM_FROM_NAME  || 'SecuroPlan';
const FROM_EMAIL = process.env.SYSTEM_FROM_EMAIL || 'noreply@securoplan.fr';

// ── Resend (prioritaire si RESEND_API_KEY présent) ────────────────────────────
async function sendViaResend({ to, subject, html }) {
  const { Resend } = require('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to,
    subject,
    html,
  });
  if (error) throw new Error(error.message);
}

// ── SMTP classique (fallback) ─────────────────────────────────────────────────
async function sendViaSMTP({ to, subject, html }) {
  const transporter = nodemailer.createTransport({
    host: process.env.SYSTEM_SMTP_HOST,
    port: parseInt(process.env.SYSTEM_SMTP_PORT) || 587,
    secure: parseInt(process.env.SYSTEM_SMTP_PORT) === 465,
    auth: { user: process.env.SYSTEM_SMTP_USER, pass: process.env.SYSTEM_SMTP_PASS },
  });
  const fromEmail = process.env.SYSTEM_FROM_EMAIL || process.env.SYSTEM_SMTP_USER;
  await transporter.sendMail({ from: `"${FROM_NAME}" <${fromEmail}>`, to, subject, html });
}

async function sendSystemEmail({ to, subject, html }) {
  try {
    if (process.env.RESEND_API_KEY) {
      await sendViaResend({ to, subject, html });
    } else if (process.env.SYSTEM_SMTP_HOST) {
      await sendViaSMTP({ to, subject, html });
    } else {
      console.warn('[SystemEmail] Aucun fournisseur email configuré (RESEND_API_KEY ou SYSTEM_SMTP_HOST) — ignoré:', subject, '→', to);
      return null;
    }
    console.log('[SystemEmail] Envoyé:', subject, '→', to);
    return { ok: true };
  } catch (e) {
    console.error('[SystemEmail] Erreur:', e.message);
    return null;
  }
}

module.exports = { sendSystemEmail };
