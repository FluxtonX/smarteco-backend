-- CreateEnum
CREATE TYPE "SortingCategory" AS ENUM ('PLASTIC', 'PAPER', 'METAL', 'GLASS', 'ORGANIC', 'GENERAL', 'RECYCLABLE');

-- CreateTable
CREATE TABLE "kiosks" (
    "id" TEXT NOT NULL,
    "kiosk_id" TEXT NOT NULL,
    "name" TEXT,
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "api_key" TEXT,
    "last_seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kiosks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sorting_events" (
    "id" TEXT NOT NULL,
    "kiosk_id" TEXT NOT NULL,
    "category" "SortingCategory" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotency_key" TEXT NOT NULL,
    "user_id" TEXT,
    "bin_id" TEXT,

    CONSTRAINT "sorting_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecopoints_ledger" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "sorting_event_id" TEXT,
    "points_awarded" INTEGER NOT NULL,
    "running_balance" INTEGER NOT NULL,
    "tier" "EcoTier" NOT NULL DEFAULT 'ECO_STARTER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ecopoints_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kiosks_kiosk_id_key" ON "kiosks"("kiosk_id");

-- CreateIndex
CREATE UNIQUE INDEX "kiosks_api_key_key" ON "kiosks"("api_key");

-- CreateIndex
CREATE UNIQUE INDEX "sorting_events_idempotency_key_key" ON "sorting_events"("idempotency_key");

-- CreateIndex
CREATE INDEX "sorting_events_kiosk_id_idx" ON "sorting_events"("kiosk_id");

-- CreateIndex
CREATE INDEX "sorting_events_user_id_idx" ON "sorting_events"("user_id");

-- CreateIndex
CREATE INDEX "sorting_events_bin_id_idx" ON "sorting_events"("bin_id");

-- CreateIndex
CREATE INDEX "sorting_events_idempotency_key_idx" ON "sorting_events"("idempotency_key");

-- CreateIndex
CREATE INDEX "ecopoints_ledger_user_id_idx" ON "ecopoints_ledger"("user_id");

-- CreateIndex
CREATE INDEX "ecopoints_ledger_sorting_event_id_idx" ON "ecopoints_ledger"("sorting_event_id");

-- CreateIndex
CREATE INDEX "ecopoints_ledger_created_at_idx" ON "ecopoints_ledger"("created_at");

-- AddForeignKey
ALTER TABLE "sorting_events" ADD CONSTRAINT "sorting_events_kiosk_id_fkey" FOREIGN KEY ("kiosk_id") REFERENCES "kiosks"("kiosk_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sorting_events" ADD CONSTRAINT "sorting_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sorting_events" ADD CONSTRAINT "sorting_events_bin_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "bins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecopoints_ledger" ADD CONSTRAINT "ecopoints_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecopoints_ledger" ADD CONSTRAINT "ecopoints_ledger_sorting_event_id_fkey" FOREIGN KEY ("sorting_event_id") REFERENCES "sorting_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
