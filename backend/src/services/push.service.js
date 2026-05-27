const webpush = require('web-push');
const PushSubscriptionModel = require('../models/pushSubscription.model');
const logger = require('../utils/logger');

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@riftsense.local';

function isConfigured() {
  return Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
}

function configureOnce() {
  if (!isConfigured()) return;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

async function sendToUser(userId, payload) {
  if (!isConfigured()) return { sent: 0, reason: 'vapid_not_configured' };
  configureOnce();

  const subs = await PushSubscriptionModel.listByUserId(userId);
  if (!subs.length) return { sent: 0, reason: 'no_subscriptions' };

  const body = JSON.stringify(payload);
  let sent = 0;

  for (const s of subs) {
    const subscription = {
      endpoint: s.endpoint,
      keys: { p256dh: s.p256dh, auth: s.auth }
    };

    try {
      await webpush.sendNotification(subscription, body);
      sent += 1;
    } catch (err) {
      const statusCode = err?.statusCode;
      // If the subscription is gone/invalid, remove it.
      if (statusCode === 404 || statusCode === 410) {
        await PushSubscriptionModel.deleteByEndpoint(userId, s.endpoint).catch(() => {});
      }
      logger.warn('Web push send failed', { statusCode, message: err?.message });
    }
  }

  return { sent };
}

module.exports = {
  sendToUser,
  isConfigured
};

