const nodemailer = require('nodemailer');

function createTransporter(settings) {
  return nodemailer.createTransport({
    host: settings.smtp_host,
    port: parseInt(settings.smtp_port) || 587,
    secure: parseInt(settings.smtp_port) === 465,
    auth: {
      user: settings.smtp_user,
      pass: settings.smtp_pass,
    },
  });
}

async function sendEmail(settings, { to, subject, html, attachments = [] }) {
  const transporter = createTransporter(settings);
  const info = await transporter.sendMail({
    from: settings.smtp_from || settings.smtp_user,
    to,
    subject,
    html,
    attachments,
  });
  return info;
}

module.exports = { sendEmail };
