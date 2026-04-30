import * as Joi from 'joi';

export const validationSchema = Joi.object({
  // App
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  // Database
  DATABASE_URL: Joi.string().required(),

  // Redis
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),

  // JWT
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRY: Joi.string().default('24h'),
  JWT_REFRESH_SECRET: Joi.string().required(),
  JWT_REFRESH_EXPIRY: Joi.string().default('7d'),

  // Africa's Talking (optional for dev)
  AT_API_KEY: Joi.string().allow('').optional(),
  AT_USERNAME: Joi.string().default('sandbox'),
  AT_SHORTCODE: Joi.string().allow('').optional(),

  // MTN MoMo (optional for dev)
  MOMO_API_KEY: Joi.string().allow('').optional(),
  MOMO_API_USER: Joi.string().allow('').optional(),
  MOMO_SUBSCRIPTION_KEY: Joi.string().allow('').optional(),
  MOMO_BASE_URL: Joi.string().default('https://sandbox.momodeveloper.mtn.com'),

  // Airtel Money (optional for dev)
  AIRTEL_CLIENT_ID: Joi.string().allow('').optional(),
  AIRTEL_CLIENT_SECRET: Joi.string().allow('').optional(),
  AIRTEL_BASE_URL: Joi.string().default('https://openapiuat.airtel.africa'),

  // Twilio (Verify + WhatsApp)
  TWILIO_ACCOUNT_SID: Joi.string().required(),
  TWILIO_AUTH_TOKEN: Joi.string().required(),
  TWILIO_VERIFY_SERVICE_SID: Joi.string().required(),
  TWILIO_WHATSAPP_NUMBER: Joi.string().allow('').optional(),
  TWILIO_WHATSAPP_FROM: Joi.string().allow('').optional(),
  TWILIO_WHATSAPP_MENU_CONTENT_SID: Joi.string().allow('').optional(),
  TWILIO_WHATSAPP_PICKUP_SCHEDULED_CONTENT_SID: Joi.string().allow('').optional(),
  TWILIO_WHATSAPP_COLLECTOR_ASSIGNED_CONTENT_SID: Joi.string().allow('').optional(),
  TWILIO_WHATSAPP_EN_ROUTE_CONTENT_SID: Joi.string().allow('').optional(),
  TWILIO_WHATSAPP_PICKUP_COMPLETED_CONTENT_SID: Joi.string().allow('').optional(),
  TWILIO_SMS_FROM: Joi.string().allow('').optional(),

  // Firebase (optional for dev)
  FIREBASE_PROJECT_ID: Joi.string().allow('').optional(),
  FIREBASE_PRIVATE_KEY: Joi.string().allow('').optional(),
  FIREBASE_CLIENT_EMAIL: Joi.string().allow('').optional(),

  // Google Maps (optional for dev)
  GOOGLE_MAPS_API_KEY: Joi.string().allow('').optional(),
});
