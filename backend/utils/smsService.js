// Normalise un numéro de téléphone français en format E.164
function normalizePhone(phone) {
  if (!phone) return null;
  let p = phone.replace(/[\s.\-()]/g, '');
  if (p.startsWith('00')) p = '+' + p.slice(2);
  if (p.startsWith('0')) p = '+33' + p.slice(1);
  if (!p.startsWith('+')) p = '+33' + p;
  return p;
}

function getTwilioClient() {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) return null;
  return require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

async function sendSMS(to, body) {
  const client = getTwilioClient();
  if (!client) {
    console.warn('[SMS] Twilio non configuré — ignoré:', to);
    return null;
  }

  const phone = normalizePhone(to);
  if (!phone) {
    console.warn('[SMS] Numéro invalide:', to);
    return null;
  }

  try {
    const message = await client.messages.create({
      body,
      from: process.env.TWILIO_FROM_NUMBER,
      to: phone,
    });
    console.log(`[SMS] Envoyé à ${phone} (${message.sid})`);
    return message;
  } catch (e) {
    console.error(`[SMS] Erreur pour ${phone}:`, e.message);
    return null; // Ne pas planter l'app pour un SMS raté
  }
}

module.exports = { sendSMS, normalizePhone };
