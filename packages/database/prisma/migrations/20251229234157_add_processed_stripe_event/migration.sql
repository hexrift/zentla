-- CreateTable
CREATE TABLE "processed_stripe_event" (
    "id" UUID NOT NULL,
    "stripe_event_id" VARCHAR(255) NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "processed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_stripe_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "processed_stripe_event_stripe_event_id_key" ON "processed_stripe_event"("stripe_event_id");

-- CreateIndex
CREATE INDEX "processed_stripe_event_stripe_event_id_idx" ON "processed_stripe_event"("stripe_event_id");

-- CreateIndex
CREATE INDEX "processed_stripe_event_processed_at_idx" ON "processed_stripe_event"("processed_at");
