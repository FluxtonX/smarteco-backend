import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET,
    expiry: process.env.JWT_EXPIRY || '24h',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },

  // Database
  database: {
    url: process.env.DATABASE_URL,
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  },

  // Africa's Talking (SMS & USSD)
  africasTalking: {
    apiKey: process.env.AT_API_KEY,
    username: process.env.AT_USERNAME || 'sandbox',
    shortcode: process.env.AT_SHORTCODE,
  },

  // MTN MoMo
  momo: {
    apiKey: process.env.MOMO_API_KEY,
    apiUser: process.env.MOMO_API_USER,
    subscriptionKey: process.env.MOMO_SUBSCRIPTION_KEY,
    baseUrl:
      process.env.MOMO_BASE_URL || 'https://sandbox.momodeveloper.mtn.com',
  },

  // Airtel Money
  airtel: {
    clientId: process.env.AIRTEL_CLIENT_ID,
    clientSecret: process.env.AIRTEL_CLIENT_SECRET,
    baseUrl: process.env.AIRTEL_BASE_URL || 'https://openapiuat.airtel.africa',
  },

  // WhatsApp (Twilio)
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    whatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER,
  },

  // Firebase
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  },

  // Google Maps
  googleMaps: {
    apiKey: process.env.GOOGLE_MAPS_API_KEY,
  },
}));
