-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('RESIDENTIAL', 'BUSINESS');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'COLLECTOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "WasteType" AS ENUM ('ORGANIC', 'RECYCLABLE', 'GENERAL', 'EWASTE', 'GLASS', 'HAZARDOUS');

-- CreateEnum
CREATE TYPE "PickupStatus" AS ENUM ('PENDING', 'CONFIRMED', 'COLLECTOR_ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TimeSlot" AS ENUM ('MORNING_8_10', 'MORNING_10_12', 'AFTERNOON_2_4', 'AFTERNOON_4_6');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('MTN_MOMO', 'AIRTEL_MONEY');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "EcoTier" AS ENUM ('ECO_STARTER', 'ECO_WARRIOR', 'ECO_CHAMPION');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SMS', 'PUSH', 'IN_APP', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "BinStatus" AS ENUM ('ACTIVE', 'FULL', 'MAINTENANCE', 'INACTIVE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "first_name" TEXT,
    "last_name" TEXT,
    "user_type" "UserType" NOT NULL DEFAULT 'RESIDENTIAL',
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "referral_code" TEXT NOT NULL,
    "referred_by" TEXT,
    "avatar_url" TEXT,
    "fcm_token" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_verifications" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "otp" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collector_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "vehicle_plate" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "photo_url" TEXT,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "total_pickups" INTEGER NOT NULL DEFAULT 0,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collector_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pickups" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "collector_id" TEXT,
    "waste_type" "WasteType" NOT NULL,
    "weight_kg" DOUBLE PRECISION,
    "scheduled_date" TIMESTAMP(3) NOT NULL,
    "time_slot" "TimeSlot" NOT NULL,
    "status" "PickupStatus" NOT NULL DEFAULT 'PENDING',
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "bin_id" TEXT,

    CONSTRAINT "pickups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bins" (
    "id" TEXT NOT NULL,
    "qr_code" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "waste_type" "WasteType" NOT NULL,
    "fill_level" INTEGER NOT NULL DEFAULT 0,
    "status" "BinStatus" NOT NULL DEFAULT 'ACTIVE',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "last_emptied" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eco_point_transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "pickup_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eco_point_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "pickup_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "transaction_ref" TEXT,
    "external_ref" TEXT,
    "paid_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "fail_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_referral_code_key" ON "users"("referral_code");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "otp_verifications_phone_otp_idx" ON "otp_verifications"("phone", "otp");

-- CreateIndex
CREATE INDEX "otp_verifications_phone_created_at_idx" ON "otp_verifications"("phone", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "collector_profiles_user_id_key" ON "collector_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "pickups_reference_key" ON "pickups"("reference");

-- CreateIndex
CREATE INDEX "pickups_user_id_idx" ON "pickups"("user_id");

-- CreateIndex
CREATE INDEX "pickups_collector_id_idx" ON "pickups"("collector_id");

-- CreateIndex
CREATE INDEX "pickups_status_idx" ON "pickups"("status");

-- CreateIndex
CREATE INDEX "pickups_scheduled_date_idx" ON "pickups"("scheduled_date");

-- CreateIndex
CREATE INDEX "pickups_reference_idx" ON "pickups"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "bins_qr_code_key" ON "bins"("qr_code");

-- CreateIndex
CREATE INDEX "bins_user_id_idx" ON "bins"("user_id");

-- CreateIndex
CREATE INDEX "bins_qr_code_idx" ON "bins"("qr_code");

-- CreateIndex
CREATE INDEX "eco_point_transactions_user_id_idx" ON "eco_point_transactions"("user_id");

-- CreateIndex
CREATE INDEX "eco_point_transactions_action_idx" ON "eco_point_transactions"("action");

-- CreateIndex
CREATE INDEX "eco_point_transactions_created_at_idx" ON "eco_point_transactions"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payments_pickup_id_key" ON "payments"("pickup_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_transaction_ref_key" ON "payments"("transaction_ref");

-- CreateIndex
CREATE INDEX "payments_user_id_idx" ON "payments"("user_id");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "payments_transaction_ref_idx" ON "payments"("transaction_ref");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "notifications_sent_at_idx" ON "notifications"("sent_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_referred_by_fkey" FOREIGN KEY ("referred_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collector_profiles" ADD CONSTRAINT "collector_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickups" ADD CONSTRAINT "pickups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickups" ADD CONSTRAINT "pickups_collector_id_fkey" FOREIGN KEY ("collector_id") REFERENCES "collector_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickups" ADD CONSTRAINT "pickups_bin_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "bins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bins" ADD CONSTRAINT "bins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eco_point_transactions" ADD CONSTRAINT "eco_point_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_pickup_id_fkey" FOREIGN KEY ("pickup_id") REFERENCES "pickups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
