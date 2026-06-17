/**
 * Relances automatiques des factures impayées.
 * Envoi à J+1, J+7, J+30 après l'échéance.
 * Marque le statut en 'overdue' à partir de J+1.
 */
const { db } = require('../db/database');
const { sendSystemEmail } = require('../utils/systemEmail');
const templates = require('../utils/emailTemplates');

const REMIND_AT_DAYS = [1, 7, 30]; // jours après échéance

function frDate(d) {
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

async function sendInvoiceReminders() {
  try {
    const today = new Date().toISOString().slice(0, 10);

    // Factures envoyées ou en retard, avec échéance dépassée, et le client a un email
    const invoices = await db.all(`
      SELECT i.id, i.invoice_number, i.due_date, i.total_ht, i.tva_rate, i.status,
             cl.name AS client_name, cl.email AS client_email,
             co.name AS company_name
      FROM invoices i
      JOIN clients cl  ON cl.id = i.client_id
      JOIN companies co ON co.id = i.company_id
      WHERE i.status IN ('sent', 'overdue')
        AND i.due_date IS NOT NULL
        AND i.due_date < ?
        AND cl.email IS NOT NULL AND cl.email != ''
    `, [today]);

    let totalSent = 0;

    for (const inv of invoices) {
      const daysLate = Math.floor(
        (new Date(today) - new Date(inv.due_date)) / 86400000
      );

      // Envoyer uniquement aux seuils J+1, J+7, J+30
      if (!REMIND_AT_DAYS.includes(daysLate)) continue;

      const totalTtc = ((inv.total_ht || 0) * (1 + (inv.tva_rate || 20) / 100)).toFixed(2);

      await sendSystemEmail({
        to: inv.client_email,
        subject: `${daysLate >= 30 ? '[URGENT] ' : ''}Rappel facture ${inv.invoice_number} — ${inv.company_name}`,
        html: templates.invoiceOverdue({
          clientName:   inv.client_name,
          companyName:  inv.company_name,
          invoiceNumber: inv.invoice_number,
          totalTtc,
          dueDate: frDate(inv.due_date),
          daysLate,
          appUrl: null,
        }),
      });

      // Passer en 'overdue' si pas encore fait
      if (inv.status !== 'overdue') {
        await db.run(
          "UPDATE invoices SET status = 'overdue' WHERE id = ?",
          [inv.id]
        );
      }

      console.log(`[Relances] Facture ${inv.invoice_number} (J+${daysLate}) → ${inv.client_email}`);
      totalSent++;
    }

    if (totalSent > 0) {
      console.log(`[Relances] ✅ ${totalSent} relance(s) envoyée(s)`);
    }
  } catch (e) {
    console.error('[Relances] Erreur:', e.message);
  }
}

module.exports = { sendInvoiceReminders };
