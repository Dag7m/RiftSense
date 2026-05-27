const PushSubscriptionModel = require('../models/pushSubscription.model');
const pushService = require('../services/push.service');
const logger = require('../utils/logger');

async function getVapidPublicKey(req, res) {
  res.json({
    success: true,
    data: { publicKey: process.env.VAPID_PUBLIC_KEY || '' }
  });
}

async function subscribe(req, res) {
  try {
    const { subscription } = req.body;
    const saved = await PushSubscriptionModel.upsert({
      user_id: req.user.id,
      subscription,
      user_agent: req.get('user-agent') || null
    });

    res.json({ success: true, data: saved });
  } catch (error) {
    logger.error('Error saving push subscription:', error);
    res.status(500).json({ success: false, error: 'Failed to save subscription' });
  }
}

async function testPush(req, res) {
  try {
    const result = await pushService.sendToUser(req.user.id, {
      title: 'RiftSense test',
      body: 'Push notifications are working.',
      type: 'test'
    });
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Error sending test push:', error);
    res.status(500).json({ success: false, error: 'Failed to send test push' });
  }
}

module.exports = {
  getVapidPublicKey,
  subscribe,
  testPush
};

