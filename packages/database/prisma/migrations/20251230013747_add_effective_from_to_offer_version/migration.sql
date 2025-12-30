-- AlterTable
ALTER TABLE "offer_version" ADD COLUMN     "effective_from" TIMESTAMPTZ;

-- CreateIndex
CREATE INDEX "offer_version_offer_id_status_effective_from_idx" ON "offer_version"("offer_id", "status", "effective_from");
