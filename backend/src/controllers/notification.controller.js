const NotificationModel = require('../models/notification.model');
const logger = require('../utils/logger');

async function listMyNotifications(req, res) {
  try {
    const { limit, unread } = req.query;
    const notifications = await NotificationModel.listForUser(req.user.id, {
      limit: limit ? parseInt(limit, 10) : 50,
      unreadOnly: unread === 'true'
    });

    res.json({ success: true, data: notifications });
  } catch (error) {
    logger.error('Error listing notifications:', error);
    res.status(500).json({ success: false, error: 'Failed to get notifications' });
  }
}

async function markNotificationRead(req, res) {
  try {
    const { id } = req.params;
    const updated = await NotificationModel.markRead(req.user.id, id);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('Error marking notification read:', error);
    res.status(500).json({ success: false, error: 'Failed to update notification' });
  }
}

async function markAllRead(req, res) {
  try {
    const count = await NotificationModel.markAllRead(req.user.id);
    res.json({ success: true, data: { updated: count } });
  } catch (error) {
    logger.error('Error marking all notifications read:', error);
    res.status(500).json({ success: false, error: 'Failed to update notifications' });
  }
}

module.exports = {
  listMyNotifications,
  markNotificationRead,
  markAllRead
};

