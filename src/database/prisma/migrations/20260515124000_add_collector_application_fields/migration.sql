ALTER TABLE "collector_profiles"
  ADD COLUMN IF NOT EXISTS "collector_name" TEXT,
  ADD COLUMN IF NOT EXISTS "is_approved" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "approved_by" TEXT;
