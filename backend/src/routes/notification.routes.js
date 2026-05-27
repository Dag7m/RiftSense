const express = require('express');
const router = express.Router();

const notificationController = require('../controllers/notification.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { asyncHandler } = require('../middlewares/error.middleware');
const { validateUUID } = require('../middlewares/validation.middleware');

router.get('/', authenticate, asyncHandler(notificationController.listMyNotifications));
router.put(
  '/:id/read',
  authenticate,
  validateUUID('id'),
  asyncHandler(notificationController.markNotificationRead)
);
router.put('/read-all', authenticate, asyncHandler(notificationController.markAllRead));

module.exports = router;

