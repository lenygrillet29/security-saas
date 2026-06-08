/**
 * Calcule les heures jour, nuit, dimanche et fériées pour un shift.
 *
 * Règles France :
 *   - Heures jour    : 06:00 – 21:00, hors dimanche et fériés
 *   - Heures nuit    : 21:00 – 06:00, hors dimanche et fériés
 *   - Heures dimanche: toutes les heures tombant un dimanche (hors fériés)
 *   - Heures fériées : toutes les heures tombant un jour férié (priorité sur dimanche)
 *
 * Un shift peut chevaucher minuit.
 */

// ── Jours fériés France ────────────────────────────────────────────────────────
function easterDate(year) {
  // Algorithme Meeus/Jones/Butcher
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 1-indexed
  const day   = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function getFrenchHolidays(year) {
  const easter = easterDate(year);
  const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  return new Set([
    `${year}-01-01`, // Jour de l'An
    fmt(addDays(easter, 1)),  // Lundi de Pâques
    `${year}-05-01`, // Fête du Travail
    `${year}-05-08`, // Victoire 1945
    fmt(addDays(easter, 39)), // Ascension
    fmt(addDays(easter, 50)), // Lundi de Pentecôte
    `${year}-07-14`, // Fête Nationale
    `${year}-08-15`, // Assomption
    `${year}-11-01`, // Toussaint
    `${year}-11-11`, // Armistice
    `${year}-12-25`, // Noël
  ]);
}

// Cache léger pour éviter de recalculer à chaque minute
const holidayCache = {};
function isHoliday(dateStr) {
  const year = parseInt(dateStr.slice(0, 4));
  if (!holidayCache[year]) holidayCache[year] = getFrenchHolidays(year);
  return holidayCache[year].has(dateStr);
}

// ── Calcul principal ───────────────────────────────────────────────────────────
function calculateHours(date, startTime, endTime) {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  let startMinutes = startH * 60 + startM;
  let endMinutes   = endH * 60 + endM;

  // Shift traverse minuit
  if (endMinutes <= startMinutes) endMinutes += 24 * 60;

  const baseDate = new Date(date + 'T00:00:00');

  let hoursDay     = 0;
  let hoursNight   = 0;
  let hoursSunday  = 0;
  let hoursHoliday = 0;

  for (let m = startMinutes; m < endMinutes; m++) {
    const minuteOfDay = m % (24 * 60);
    const dayOffset   = Math.floor(m / (24 * 60));

    const currentDate = new Date(baseDate);
    currentDate.setDate(currentDate.getDate() + dayOffset);

    const yy  = currentDate.getFullYear();
    const mm  = String(currentDate.getMonth() + 1).padStart(2, '0');
    const dd  = String(currentDate.getDate()).padStart(2, '0');
    const dateStr = `${yy}-${mm}-${dd}`;
    const dow     = currentDate.getDay(); // 0 = dimanche

    if (isHoliday(dateStr)) {
      // Férié — prioritaire sur tout le reste
      hoursHoliday += 1 / 60;
    } else if (dow === 0) {
      // Dimanche (non férié)
      hoursSunday += 1 / 60;
    } else {
      // Jour normal : jour ou nuit
      const hourOfDay = minuteOfDay / 60;
      if (hourOfDay >= 6 && hourOfDay < 21) {
        hoursDay += 1 / 60;
      } else {
        hoursNight += 1 / 60;
      }
    }
  }

  const round = (v) => Math.round(v * 100) / 100;

  return {
    total:         round((endMinutes - startMinutes) / 60),
    hours_day:     round(hoursDay),
    hours_night:   round(hoursNight),
    hours_sunday:  round(hoursSunday),
    hours_holiday: round(hoursHoliday),
  };
}

function formatHours(h) {
  if (!h) return '0h';
  const hours   = Math.floor(h);
  const minutes = Math.round((h - hours) * 60);
  return `${hours}h${minutes > 0 ? String(minutes).padStart(2, '0') : ''}`;
}

module.exports = { calculateHours, formatHours, isHoliday, getFrenchHolidays };
