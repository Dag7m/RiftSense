const express = require('express');
const router = express.Router();

const locationController = require('../controllers/location.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { validateBody } = require('../middlewares/validation.middleware');
const { asyncHandler } = require('../middlewares/error.middleware');
const Joi = require('joi');

const upsertLocationSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  radius_km: Joi.number().min(0).max(1000).optional().allow(null),
  notifications_enabled: Joi.boolean().optional()
});

router.get('/me', authenticate, asyncHandler(locationController.getMyLocation));
router.put(
  '/me',
  authenticate,
  validateBody(upsertLocationSchema),
  asyncHandler(locationController.upsertMyLocation)
);

module.exports = router;

