const cron = require('node-cron');
const { db } = require('../db/database');
const { sendSystemEmail } = require('../utils/systemEmail');
const { sendSMS } = require('../utils/smsService');
const templates = require('../utils/emailTemplates');
const { sendInvoiceReminders } = require('./invoiceReminders');
const { sendCarteProAlerts }   = require('./carteProAlerts');
const { sendTimedReminders }   = require('../routes/agent-portal');

function frDate(d) {
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ─── Rappels fin d'essai J-7 et J-1 ──────────────────────────────────────────
async function sendTrialReminders() {
  try {
    const companies = await db.all(`
      SELECT c.*, u.first_name, u.email AS user_email
      FROM companies c
      JOIN users u ON u.company_id = c.id AND u.role = 'admin'
      WHERE c.plan_status = 'trialing'
        AND c.plan != 'lifetime'
        AND c.trial_ends_at IS NOT NULL
        AND u.active = 1
    `);

    for (const co of companies) {
      const daysLeft = Math.ceil((new Date(co.trial_ends_at) - Date.now()) / 86400000);
      if (daysLeft === 7 || daysLeft === 1) {
        await sendSystemEmail({
          to: co.user_email,
          subject: daysLeft === 1
            ? '⏰ Votre essai gratuit se termine demain'
            : `⏳ Plus que ${daysLeft} jours d'essai gratuit`,
          html: templates.trialEnding({
            firstName:    co.first_name,
            companyName:  co.name,
            daysLeft,
            trialEndDate: frDate(co.trial_ends_at),
          }),
        });
        console.log(`[Scheduler] Rappel essai J-${daysLeft} → ${co.user_email}`);
      }
    }
  } catch (e) {
    console.error('[Scheduler] Erreur rappels essai:', e.message);
  }
}

// ─── SMS rappels agents (J-1 avant prestation) ────────────────────────────────
async function sendShiftSMSReminders() {
  if (!process.env.TWILIO_ACCOUNT_SID) return;

  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const shifts = await db.all(`
      SELECT sh.*,
             a.first_name AS agent_first, a.last_name AS agent_last, a.phone AS agent_phone,
             s.name AS site_name, s.address AS site_address, s.instructions AS site_instructions
      FROM shifts sh
      JOIN agents a ON sh.agent_id = a.id
      JOIN sites  s ON sh.site_id  = s.id
      WHERE sh.date = ?
        AND a.phone IS NOT NULL AND a.phone != ''
        AND a.active = 1
    `, [tomorrowStr]);

    for (const shift of shifts) {
      const lines = [
        `🛡 SecuroPlan — Rappel prestation demain`,
        `📍 ${shift.site_name}`,
        `🕐 ${shift.start_time} – ${shift.end_time}`,
      ];
      if (shift.site_address)       lines.push(`📌 ${shift.site_address}`);
      if (shift.site_instructions)  lines.push(`📋 ${shift.site_instructions}`);

      await sendSMS(shift.agent_phone, lines.join('\n'));
    }

    if (shifts.length > 0) {
      console.log(`[Scheduler] SMS rappels envoyés : ${shifts.length} prestation(s) demain`);
    }
  } catch (e) {
    console.error('[Scheduler] Erreur SMS rappels shifts:', e.message);
  }
}

// ─── Démarrage ────────────────────────────────────────────────────────────────
function startScheduler() {
  // Rappels fin d'essai — tous les jours à 9h00 (Paris)
  cron.schedule('0 9 * * *', sendTrialReminders, { timezone: 'Europe/Paris' });

  // SMS rappels shifts — tous les jours à 18h00 (Paris)
  cron.schedule('0 18 * * *', sendShiftSMSReminders, { timezone: 'Europe/Paris' });

  // Relances factures impayées — tous les jours à 9h30 (Paris)
  cron.schedule('30 9 * * *', sendInvoiceReminders, { timezone: 'Europe/Paris' });

  // Alertes carte pro — tous les jours à 8h00 (Paris)
  cron.schedule('0 8 * * *', sendCarteProAlerts, { timezone: 'Europe/Paris' });

  // Notifications push agents — toutes les 15 min (rappels J-1 et H-2)
  cron.schedule('*/15 * * * *', sendTimedReminders, { timezone: 'Europe/Paris' });

  console.log('[Scheduler] Démarré — rappels essai (9h00) · SMS shifts (18h00) · relances factures (9h30) · alertes carte pro (8h00) · push agents (*/15min)');
}

module.exports = { startScheduler, sendTrialReminders, sendShiftSMSReminders };
