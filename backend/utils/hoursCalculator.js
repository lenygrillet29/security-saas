/**
 * Calcule les heures jour, nuit et dimanche pour un shift.
 * - Heures jour : 06:00 - 21:00 (jours non-dimanche)
 * - Heures nuit : 21:00 - 06:00 (jours non-dimanche)
 * - Heures dimanche : toutes les heures du dimanche
 * Un shift peut chevaucher minuit.
 */
function calculateHours(date, startTime, endTime) {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  let startMinutes = startH * 60 + startM;
  let endMinutes = endH * 60 + endM;

  // Shift traverse minuit
  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60;
  }

  const baseDate = new Date(date + 'T00:00:00');

  let hoursDay = 0;
  let hoursNight = 0;
  let hoursSunday = 0;

  // Itération minute par minute (précis pour les cas limites)
  for (let m = startMinutes; m < endMinutes; m++) {
    const minuteOfDay = m % (24 * 60);
    const dayOffset = Math.floor(m / (24 * 60));

    const currentDate = new Date(baseDate);
    currentDate.setDate(currentDate.getDate() + dayOffset);
    const dow = currentDate.getDay(); // 0 = dimanche

    if (dow === 0) {
      hoursSunday += 1 / 60;
    } else {
      const hourOfDay = minuteOfDay / 60;
      if (hourOfDay >= 6 && hourOfDay < 21) {
        hoursDay += 1 / 60;
      } else {
        hoursNight += 1 / 60;
      }
    }
  }

  return {
    total: (endMinutes - startMinutes) / 60,
    hours_day: Math.round(hoursDay * 100) / 100,
    hours_night: Math.round(hoursNight * 100) / 100,
    hours_sunday: Math.round(hoursSunday * 100) / 100,
  };
}

function formatHours(h) {
  const hours = Math.floor(h);
  const minutes = Math.round((h - hours) * 60);
  return `${hours}h${minutes > 0 ? String(minutes).padStart(2, '0') : ''}`;
}

module.exports = { calculateHours, formatHours };
