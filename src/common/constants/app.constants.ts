// ─── App Constants ───────────────────────────────

export const APP_NAME = 'SmartEco';
export const API_PREFIX = 'api/v1';
export const SWAGGER_PATH = 'api/docs';

// ─── OTP ─────────────────────────────────────────

export const OTP_LENGTH = 6;
export const OTP_EXPIRY_MINUTES = 5;
export const OTP_MAX_ATTEMPTS = 3;
export const OTP_RATE_LIMIT_MINUTES = 1;
export const OTP_RATE_LIMIT_MAX = 3;
export const SANDBOX_OTP = '123456';

// ─── JWT ─────────────────────────────────────────

export const JWT_DEFAULT_EXPIRY = '24h';
export const JWT_REFRESH_DEFAULT_EXPIRY = '7d';

// ─── EcoPoints ───────────────────────────────────

export const ECOPOINTS = {
  REGISTRATION_BONUS: 100,
  REFERRAL_BONUS: 200,
  ORGANIC_PER_KG: 15,
  RECYCLABLE_PER_KG: 20,
  EWASTE_PER_ITEM: 50,
  GENERAL_PER_KG: 5,
  GLASS_PER_KG: 10,
  HAZARDOUS_PER_ITEM: 30,
};

// ─── Tier Thresholds ─────────────────────────────

export const TIER_THRESHOLDS = {
  ECO_STARTER: { min: 0, max: 999, multiplier: 1.0 },
  ECO_WARRIOR: { min: 1000, max: 4999, multiplier: 1.25 },
  ECO_CHAMPION: { min: 5000, max: Infinity, multiplier: 1.5 },
};

// ─── Pickup ──────────────────────────────────────

export const PICKUP_REFERENCE_PREFIX = 'ECO-';
export const PICKUP_REFERENCE_LENGTH = 5;
export const PICKUP_MIN_ADVANCE_HOURS = 24;
export const MAX_PICKUPS_PER_COLLECTOR_PER_DAY = 8;
export const PICKUP_PRICES = {
  ORGANIC: 100,
  RECYCLABLE: 150,
  EWASTE: 500,
  GENERAL: 120,
  GLASS: 200,
  HAZARDOUS: 700,
};

// ─── Bin ─────────────────────────────────────────

export const BIN_QR_PREFIX = 'BIN-';
export const BIN_ALERT_THRESHOLD = 80; // percentage
export const BIN_AUTO_SCHEDULE_THRESHOLD = 95; // percentage
export const BINS_PER_USER = 5;

export const BIN_WASTE_TYPES = [
  'ORGANIC',
  'RECYCLABLE',
  'EWASTE',
  'GENERAL',
  'HAZARDOUS',
] as const;

// ─── Collector ───────────────────────────────────

export const DEFAULT_COLLECTOR_RATING = 5.0;
export const AVERAGE_CITY_SPEED_KMH = 30;

// ─── Rwanda ──────────────────────────────────────

export const RWANDA_COUNTRY_CODE = '+250';
export const DEFAULT_CURRENCY = 'RWF';
