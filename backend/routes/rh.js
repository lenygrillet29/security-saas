const express = require('express');
const router  = express.Router();
const { db }  = require('../db/database');

// GET /api/rh/dashboard?month=2026-06
// Retourne une ligne par agent actif avec toutes les infos RH du mois
router.get('/dashboard', async (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const [year, mon] = month.split('-');
    const startDate = `${month}-01`;
    const endDate   = new Date(year, mon, 0).toISOString().slice(0, 10);
    const today     = new Date().toISOString().slice(0, 10);

    const agents = await db.all(
      `SELECT id, first_name, last_name, color, contract_type, hourly_rate,
              employee_number, entry_date, carte_pro_expiry, email, phone
       FROM agents WHERE company_id = ? AND active = 1
       ORDER BY last_name, first_name`,
      [req.user.companyId]
    );

    const results = await Promise.all(agents.map(async (a) => {
      // Heures du mois
      const hoursRow = await db.get(`
        SELECT
          COALESCE(SUM(hours_day),0)                  AS hours_day,
          COALESCE(SUM(hours_night),0)                AS hours_night,
          COALESCE(SUM(hours_sunday),0)               AS hours_sunday,
          COALESCE(SUM(hours_sunday_night),0)         AS hours_sunday_night,
          COALESCE(SUM(hours_holiday),0)              AS hours_holiday,
          COALESCE(SUM(hours_holiday_night),0)        AS hours_holiday_night,
          COALESCE(SUM(hours_holiday_sunday_day),0)   AS hours_holiday_sunday_day,
          COALESCE(SUM(hours_holiday_sunday_night),0) AS hours_holiday_sunday_night,
          COUNT(*) AS shift_count
        FROM shifts
        WHERE agent_id = ? AND company_id = ? AND date >= ? AND date <= ?
      `, [a.id, req.user.companyId, startDate, endDate]);

      const totalHours = ['hours_day','hours_night','hours_sunday','hours_sunday_night',
        'hours_holiday','hours_holiday_night','hours_holiday_sunday_day','hours_holiday_sunday_night']
        .reduce((s, k) => s + (parseFloat(hoursRow[k]) || 0), 0);

      // Absences du mois
      const absences = await db.all(`
        SELECT type, status, start_date, end_date FROM absences
        WHERE agent_id = ? AND company_id = ?
          AND start_date <= ? AND end_date >= ?
      `, [a.id, req.user.companyId, endDate, startDate]);

      const absenceDays = absences
        .filter(ab => ab.status === 'approved')
        .reduce((s, ab) => {
          const s1 = new Date(Math.max(new Date(ab.start_date), new Date(startDate)));
          const e1 = new Date(Math.min(new Date(ab.end_date),   new Date(endDate)));
          return s + Math.max(0, Math.round((e1 - s1) / 86400000) + 1);
        }, 0);

      // Solde CP
      const cpRow = await db.get(
        `SELECT COALESCE(SUM(days), 0) AS balance FROM cp_transactions WHERE agent_id = ? AND company_id = ?`,
        [a.id, req.user.companyId]
      );

      // Notes de frais du mois
      const expRow = await db.get(`
        SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
        FROM expense_reports
        WHERE agent_id = ? AND company_id = ? AND date >= ? AND date <= ? AND status = 'approved'
      `, [a.id, req.user.companyId, startDate, endDate]);

      // Contrat actif
      const contract = await db.get(
        `SELECT type, start_date, end_date, gross_salary FROM contracts
         WHERE agent_id = ? AND company_id = ? AND status = 'signed'
         ORDER BY start_date DESC LIMIT 1`,
        [a.id, req.user.companyId]
      );

      // Carte pro
      const carteExpired = a.carte_pro_expiry && a.carte_pro_expiry < today;
      const carteDaysLeft = a.carte_pro_expiry
        ? Math.ceil((new Date(a.carte_pro_expiry) - new Date(today)) / 86400000)
        : null;

      return {
        agent_id:       a.id,
        first_name:     a.first_name,
        last_name:      a.last_name,
        color:          a.color,
        contract_type:  a.contract_type,
        employee_number:a.employee_number,
        entry_date:     a.entry_date,
        // Heures
        total_hours:    Math.round(totalHours * 100) / 100,
        shift_count:    parseInt(hoursRow.shift_count) || 0,
        hours_breakdown: {
          day:           parseFloat(hoursRow.hours_day) || 0,
          night:         parseFloat(hoursRow.hours_night) || 0,
          sunday:        parseFloat(hoursRow.hours_sunday) || 0,
          holiday:       parseFloat(hoursRow.hours_holiday) || 0,
        },
        // Absences
        absence_days:   absenceDays,
        absence_count:  absences.length,
        // CP
        cp_balance:     Math.round((parseFloat(cpRow.balance) || 0) * 10) / 10,
        // Frais
        expenses_total: Math.round((parseFloat(expRow.total) || 0) * 100) / 100,
        expenses_count: parseInt(expRow.count) || 0,
        // Contrat
        contract:       contract || null,
        // Carte pro
        carte_pro_expiry:  a.carte_pro_expiry || null,
        carte_pro_expired: carteExpired,
        carte_pro_days_left: carteDaysLeft,
      };
    }));

    res.json(results);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
