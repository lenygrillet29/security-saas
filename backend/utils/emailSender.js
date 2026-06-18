const nodemailer = require('nodemailer');

async function sendEmail(settings, { to, subject, html, attachments = [] }) {
  // Si le client a configuré son propre SMTP, on l'utilise
  if (settings?.smtp_host && settings?.smtp_user) {
    const transporter = nodemailer.createTransport({
      host: settings.smtp_host,
      port: parseInt(settings.smtp_port) || 587,
      secure: parseInt(settings.smtp_port) === 465,
      auth: { user: settings.smtp_user, pass: settings.smtp_pass },
    });
    return transporter.sendMail({
      from: settings.smtp_from || settings.smtp_user,
      to, subject, html, attachments,
    });
  }

  // Fallback : Resend
  if (process.env.RESEND_API_KEY) {
    const { Resend } = require('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromName  = settings?.company_name || 'SecuroPlan';
    const fromEmail = process.env.SYSTEM_FROM_EMAIL || 'noreply@securoplan.fr';
    const { error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to, subject, html,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  }

  throw new Error('Aucun fournisseur email configuré (SMTP ou RESEND_API_KEY)');
}

module.exports = { sendEmail };
