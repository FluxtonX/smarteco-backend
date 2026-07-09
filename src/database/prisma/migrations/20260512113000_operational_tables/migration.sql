-- Operational tables for IoT, communications, redemptions, support, audit, settings, and collector documents.

CREATE TYPE "IotDeviceStatus" AS ENUM ('ONLINE', 'OFFLINE', 'WARNING', 'MAINTENANCE');
CREATE TYPE "CommunicationChannel" AS ENUM ('SMS', 'WHATSAPP', 'USSD', 'PUSH', 'IN_APP');
CREATE TYPE "CommunicationDirection" AS ENUM ('INBOUND', 'OUTBOUND');
CREATE TYPE "CommunicationStatus" AS ENUM ('RECEIVED', 'SENT', 'QUEUED', 'FAILED');
CREATE TYPE "RedemptionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "SupportDisputeStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'CLOSED');
CREATE TYPE "SupportDisputePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "AuditStatus" AS ENUM ('SUCCESS', 'FAILED', 'PENDING');

ALTER TABLE "users"
  ADD COLUMN "default_address" TEXT,
  ADD COLUMN "home_latitude" DOUBLE PRECISION,
  ADD COLUMN "home_longitude" DOUBLE PRECISION;

ALTER TABLE "collector_profiles"
  ADD COLUMN "zone_polygon" JSONB,
  ADD COLUMN "license_document_url" TEXT,
  ADD COLUMN "license_document_key" TEXT,
  ADD COLUMN "id_document_url" TEXT,
  ADD COLUMN "id_document_key" TEXT;

CREATE TABLE "iot_devices" (
  "id" TEXT NOT NULL,
  "device_id" TEXT NOT NULL,
  "bin_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "status" "IotDeviceStatus" NOT NULL DEFAULT 'OFFLINE',
  "firmware" TEXT,
  "battery_level" INTEGER,
  "signal_rssi" DOUBLE PRECISION,
  "last_seen_at" TIMESTAMP(3),
  "registered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "iot_devices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "iot_telemetry" (
  "id" TEXT NOT NULL,
  "device_id" TEXT,
  "bin_id" TEXT NOT NULL,
  "fill_level" INTEGER NOT NULL,
  "battery_level" INTEGER,
  "signal_rssi" DOUBLE PRECISION,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "raw_payload" JSONB,
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "iot_telemetry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "communication_logs" (
  "id" TEXT NOT NULL,
  "channel" "CommunicationChannel" NOT NULL,
  "direction" "CommunicationDirection" NOT NULL,
  "status" "CommunicationStatus" NOT NULL,
  "phone" TEXT,
  "user_id" TEXT,
  "subject" TEXT,
  "message" TEXT NOT NULL,
  "metadata" JSONB,
  "provider_ref" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "communication_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payment_webhook_logs" (
  "id" TEXT NOT NULL,
  "payment_id" TEXT,
  "provider" "PaymentMethod" NOT NULL,
  "transaction_ref" TEXT,
  "external_ref" TEXT,
  "status" "PaymentStatus",
  "payload" JSONB NOT NULL,
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_webhook_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "redemptions" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "reward_id" TEXT NOT NULL,
  "reward_label" TEXT NOT NULL,
  "points" INTEGER NOT NULL,
  "status" "RedemptionStatus" NOT NULL DEFAULT 'PENDING',
  "provider" "PaymentMethod",
  "provider_ref" TEXT,
  "metadata" JSONB,
  "completed_at" TIMESTAMP(3),
  "failed_at" TIMESTAMP(3),
  "fail_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "redemptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "support_disputes" (
  "id" TEXT NOT NULL,
  "user_id" TEXT,
  "pickup_id" TEXT,
  "payment_id" TEXT,
  "subject" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" "SupportDisputeStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "SupportDisputePriority" NOT NULL DEFAULT 'MEDIUM',
  "assigned_to" TEXT,
  "resolution" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "resolved_at" TIMESTAMP(3),
  CONSTRAINT "support_disputes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_logs" (
  "id" TEXT NOT NULL,
  "actor_id" TEXT,
  "actor_name" TEXT,
  "module" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "details" TEXT,
  "status" "AuditStatus" NOT NULL DEFAULT 'SUCCESS',
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "system_settings" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "updated_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "iot_devices_device_id_key" ON "iot_devices"("device_id");
CREATE UNIQUE INDEX "iot_devices_bin_id_key" ON "iot_devices"("bin_id");
CREATE INDEX "iot_devices_user_id_idx" ON "iot_devices"("user_id");
CREATE INDEX "iot_devices_status_idx" ON "iot_devices"("status");
CREATE INDEX "iot_devices_last_seen_at_idx" ON "iot_devices"("last_seen_at");

CREATE INDEX "iot_telemetry_device_id_idx" ON "iot_telemetry"("device_id");
CREATE INDEX "iot_telemetry_bin_id_idx" ON "iot_telemetry"("bin_id");
CREATE INDEX "iot_telemetry_received_at_idx" ON "iot_telemetry"("received_at");

CREATE INDEX "communication_logs_channel_idx" ON "communication_logs"("channel");
CREATE INDEX "communication_logs_direction_idx" ON "communication_logs"("direction");
CREATE INDEX "communication_logs_phone_idx" ON "communication_logs"("phone");
CREATE INDEX "communication_logs_user_id_idx" ON "communication_logs"("user_id");
CREATE INDEX "communication_logs_created_at_idx" ON "communication_logs"("created_at");

CREATE INDEX "payment_webhook_logs_payment_id_idx" ON "payment_webhook_logs"("payment_id");
CREATE INDEX "payment_webhook_logs_provider_idx" ON "payment_webhook_logs"("provider");
CREATE INDEX "payment_webhook_logs_transaction_ref_idx" ON "payment_webhook_logs"("transaction_ref");
CREATE INDEX "payment_webhook_logs_received_at_idx" ON "payment_webhook_logs"("received_at");

CREATE INDEX "redemptions_user_id_idx" ON "redemptions"("user_id");
CREATE INDEX "redemptions_reward_id_idx" ON "redemptions"("reward_id");
CREATE INDEX "redemptions_status_idx" ON "redemptions"("status");
CREATE INDEX "redemptions_created_at_idx" ON "redemptions"("created_at");

CREATE INDEX "support_disputes_user_id_idx" ON "support_disputes"("user_id");
CREATE INDEX "support_disputes_status_idx" ON "support_disputes"("status");
CREATE INDEX "support_disputes_priority_idx" ON "support_disputes"("priority");
CREATE INDEX "support_disputes_created_at_idx" ON "support_disputes"("created_at");

CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");
CREATE INDEX "audit_logs_module_idx" ON "audit_logs"("module");
CREATE INDEX "audit_logs_status_idx" ON "audit_logs"("status");
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");
CREATE INDEX "system_settings_key_idx" ON "system_settings"("key");

ALTER TABLE "iot_devices" ADD CONSTRAINT "iot_devices_bin_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "bins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "iot_devices" ADD CONSTRAINT "iot_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "iot_telemetry" ADD CONSTRAINT "iot_telemetry_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "iot_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "iot_telemetry" ADD CONSTRAINT "iot_telemetry_bin_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "bins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_webhook_logs" ADD CONSTRAINT "payment_webhook_logs_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_disputes" ADD CONSTRAINT "support_disputes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
