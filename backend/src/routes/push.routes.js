const express = require('express');
const router = express.Router();

const pushController = require('../controllers/push.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { validateBody } = require('../middlewares/validation.middleware');
const { asyncHandler } = require('../middlewares/error.middleware');
const Joi = require('joi');

const subscribeSchema = Joi.object({
  subscription: Joi.object({
    endpoint: Joi.string().required(),
    keys: Joi.object({
      p256dh: Joi.string().required(),
      auth: Joi.string().required()
    }).required()
  }).required()
});

router.get('/vapid-public-key', asyncHandler(pushController.getVapidPublicKey));
router.post(
  '/subscribe',
  authenticate,
  validateBody(subscribeSchema),
  asyncHandler(pushController.subscribe)
);
router.post('/test', authenticate, asyncHandler(pushController.testPush));

module.exports = router;

