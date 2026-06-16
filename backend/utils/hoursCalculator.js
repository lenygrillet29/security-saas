/**
 * Calcule les 8 catégories d'heures majorées pour un shift.
 *
 * Règles France :
 *   - hours_day              : 06h–21h, semaine normale (ni dim, ni férié)
 *   - hours_night            : 21h–06h, semaine normale (ni dim, ni férié)
 *   - hours_sunday           : dimanche 06h–21h (pas férié)
 *   - hours_sunday_night     : dimanche 21h–06h (pas férié)
 *   - hours_holiday          : jour férié 06h–21h (pas dimanche)
 *   - hours_holiday_night    : jour férié 21h–06h (pas dimanche)
 *   - hours_holiday_sunday_day  : jour férié + dimanche, 06h–21h
 *   - hours_holiday_sunday_night: jour férié + dimanche, 21h–06h
 *
 * Un shift peut chevaucher minuit — la date est recalculée minute par minute.
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

  let hoursDay                = 0;
  let hoursNight              = 0;
  let hoursSunday             = 0;
  let hoursSundayNight        = 0;
  let hoursHoliday            = 0;
  let hoursHolidayNight       = 0;
  let hoursHolidaySundayDay   = 0;
  let hoursHolidaySundayNight = 0;

  for (let m = startMinutes; m < endMinutes; m++) {
    const minuteOfDay = m % (24 * 60);
    const dayOffset   = Math.floor(m / (24 * 60));

    const currentDate = new Date(baseDate);
    currentDate.setDate(currentDate.getDate() + dayOffset);

    const yy  = currentDate.getFullYear();
    const mo  = String(currentDate.getMonth() + 1).padStart(2, '0');
    const dd  = String(currentDate.getDate()).padStart(2, '0');
    const dateStr = `${yy}-${mo}-${dd}`;
    const dow     = currentDate.getDay(); // 0 = dimanche

    const isSun  = dow === 0;
    const isFer  = isHoliday(dateStr);
    const hourOfDay = minuteOfDay / 60;
    const isNight = hourOfDay >= 21 || hourOfDay < 6;

    if (isFer && isSun) {
      if (isNight) hoursHolidaySundayNight += 1 / 60;
      else         hoursHolidaySundayDay   += 1 / 60;
    } else if (isFer) {
      if (isNight) hoursHolidayNight += 1 / 60;
      else         hoursHoliday      += 1 / 60;
    } else if (isSun) {
      if (isNight) hoursSundayNight += 1 / 60;
      else         hoursSunday      += 1 / 60;
    } else {
      if (isNight) hoursNight += 1 / 60;
      else         hoursDay   += 1 / 60;
    }
  }

  const round = (v) => Math.round(v * 100) / 100;

  return {
    total:                      round((endMinutes - startMinutes) / 60),
    hours_day:                  round(hoursDay),
    hours_night:                round(hoursNight),
    hours_sunday:               round(hoursSunday),
    hours_sunday_night:         round(hoursSundayNight),
    hours_holiday:              round(hoursHoliday),
    hours_holiday_night:        round(hoursHolidayNight),
    hours_holiday_sunday_day:   round(hoursHolidaySundayDay),
    hours_holiday_sunday_night: round(hoursHolidaySundayNight),
  };
}

function formatHours(h) {
  if (!h) return '0h';
  const hours   = Math.floor(h);
  const minutes = Math.round((h - hours) * 60);
  return `${hours}h${minutes > 0 ? String(minutes).padStart(2, '0') : ''}`;
}

module.exports = { calculateHours, formatHours, isHoliday, getFrenchHolidays };
