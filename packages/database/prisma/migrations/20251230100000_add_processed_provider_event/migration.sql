-- CreateTable
CREATE TABLE "processed_provider_event" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider" "provider" NOT NULL,
    "provider_event_id" VARCHAR(255) NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "processed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_provider_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "processed_provider_event_processed_at_idx" ON "processed_provider_event"("processed_at");

-- CreateIndex
CREATE UNIQUE INDEX "processed_provider_event_provider_provider_event_id_key" ON "processed_provider_event"("provider", "provider_event_id");

-- Migrate existing data from processed_stripe_event to processed_provider_event
INSERT INTO "processed_provider_event" ("id", "provider", "provider_event_id", "event_type", "processed_at")
SELECT "id", 'stripe'::"provider", "stripe_event_id", "event_type", "processed_at"
FROM "processed_stripe_event"
ON CONFLICT DO NOTHING;
