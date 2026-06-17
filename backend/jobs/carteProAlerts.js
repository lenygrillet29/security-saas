/**
 * Alertes carte professionnelle expirée ou bientôt expirée.
 * Envoi email au(x) admin(s) de la société à J-30, J-7, J-1 et J+0 (expirée).
 */
const { db } = require('../db/database');
const { sendSystemEmail } = require('../utils/systemEmail');

const THRESHOLDS = [30, 7, 1, 0]; // jours avant expiration (0 = jour J)

function frDate(d) {
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

async function sendCarteProAlerts() {
  try {
    const today = new Date().toISOString().slice(0, 10);

    for (const daysLeft of THRESHOLDS) {
      const targetDate = new Date(Date.now() + daysLeft * 86400000).toISOString().slice(0, 10);

      const agents = await db.all(`
        SELECT a.id, a.first_name, a.last_name, a.carte_pro, a.carte_pro_expiry,
               u.email AS admin_email, u.first_name AS admin_first,
               co.name AS company_name
        FROM agents a
        JOIN companies co ON co.id = a.company_id
        JOIN users u ON u.company_id = a.company_id AND u.role = 'admin' AND u.active = 1
        WHERE a.active = 1
          AND a.carte_pro_expiry = ?
      `, [targetDate]);

      for (const a of agents) {
        const subject = daysLeft === 0
          ? `🔴 Carte pro expirée — ${a.first_name} ${a.last_name}`
          : `⚠️ Carte pro expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''} — ${a.first_name} ${a.last_name}`;

        const color = daysLeft === 0 ? '#ef4444' : daysLeft <= 7 ? '#f59e0b' : '#3b82f6';
        const msg = daysLeft === 0
          ? `La carte professionnelle de <strong>${a.first_name} ${a.last_name}</strong> a expiré le <strong style="color:${color}">${frDate(a.carte_pro_expiry)}</strong>. Cet agent ne peut plus exercer légalement — renouvelez sa carte au plus vite.`
          : `La carte professionnelle de <strong>${a.first_name} ${a.last_name}</strong> expire le <strong style="color:${color}">${frDate(a.carte_pro_expiry)}</strong> (dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}). Pensez à lancer le renouvellement.`;

        await sendSystemEmail({
          to: a.admin_email,
          subject,
          html: `
            <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#0f172a;color:#e2e8f0;padding:32px;border-radius:12px;">
              <div style="font-size:24px;margin-bottom:8px;">${daysLeft === 0 ? '🔴' : '⚠️'} Carte professionnelle</div>
              <p style="color:#94a3b8;font-size:14px;line-height:1.7;margin:0 0 24px;">${msg}</p>
              <table style="width:100%;background:#1e293b;border-radius:8px;padding:16px 20px;" cellpadding="0" cellspacing="0">
                <tr><td style="color:#64748b;font-size:12px;padding:4px 0;">Agent</td><td style="color:white;font-size:14px;font-weight:600;">${a.first_name} ${a.last_name}</td></tr>
                ${a.carte_pro ? `<tr><td style="color:#64748b;font-size:12px;padding:4px 0;">N° carte</td><td style="color:white;font-size:14px;">${a.carte_pro}</td></tr>` : ''}
                <tr><td style="color:#64748b;font-size:12px;padding:4px 0;">Expiration</td><td style="color:${color};font-size:14px;font-weight:600;">${frDate(a.carte_pro_expiry)}</td></tr>
              </table>
              <p style="color:#475569;font-size:11px;margin-top:20px;text-align:center;">SecuroPlan — ${a.company_name}</p>
            </div>`,
        });

        console.log(`[CartePro] Alerte J${daysLeft === 0 ? '+0' : `-${daysLeft}`} → ${a.admin_email} (${a.first_name} ${a.last_name})`);
      }
    }
  } catch (e) {
    console.error('[CartePro] Erreur alertes:', e.message);
  }
}

module.exports = { sendCarteProAlerts };
