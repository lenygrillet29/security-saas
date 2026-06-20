const webpush = require('web-push');
const { db }  = require('../db/database');

async function sendPushToCompany(companyId, payload) {
  if (!process.env.VAPID_PUBLIC_KEY) return;
  const subs = await db.all(
    'SELECT endpoint, p256dh, auth FROM user_push_subscriptions WHERE company_id = ?',
    [companyId]
  );
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      );
    } catch (err) {
      if (err.statusCode === 410) {
        await db.run('DELETE FROM user_push_subscriptions WHERE endpoint = ?', [sub.endpoint]);
      }
    }
  }
}

module.exports = { sendPushToCompany };
