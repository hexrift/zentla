import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../database/prisma.service";
import { DunningService } from "./dunning.service";

@Injectable()
export class DunningSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(DunningSchedulerService.name);
  private isProcessing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly dunningService: DunningService,
  ) {}

  onModuleInit(): void {
    this.logger.log("Dunning scheduler initialized");
  }

  /**
   * Process pending dunning attempts every minute.
   * Finds attempts that are scheduled for now or earlier and processes them.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processPendingAttempts(): Promise<void> {
    if (this.isProcessing) {
      this.logger.debug("Already processing dunning attempts, skipping");
      return;
    }

    this.isProcessing = true;

    try {
      const now = new Date();

      // Find all pending attempts that are due
      const pendingAttempts = await this.prisma.dunningAttempt.findMany({
        where: {
          status: "pending",
          scheduledAt: { lte: now },
        },
        orderBy: { scheduledAt: "asc" },
        take: 50, // Process in batches
      });

      if (pendingAttempts.length === 0) {
        return;
      }

      this.logger.log(
        `Processing ${pendingAttempts.length} pending dunning attempts`,
      );

      // Process each attempt
      const results = await Promise.allSettled(
        pendingAttempts.map((attempt) =>
          this.dunningService.processDunningAttempt(attempt.id),
        ),
      );

      // Log results
      const succeeded = results.filter(
        (r) => r.status === "fulfilled" && r.value.success,
      ).length;
      const failed = results.filter(
        (r) => r.status === "fulfilled" && !r.value.success,
      ).length;
      const errors = results.filter((r) => r.status === "rejected").length;

      this.logger.log(
        `Dunning batch complete: ${succeeded} succeeded, ${failed} failed, ${errors} errors`,
      );

      // Log any errors
      results.forEach((result, index) => {
        if (result.status === "rejected") {
          this.logger.error(
            `Failed to process attempt ${pendingAttempts[index].id}: ${result.reason}`,
          );
        }
      });
    } catch (error) {
      this.logger.error("Error processing dunning attempts", error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Check for invoices that should be in dunning but aren't.
   * This catches edge cases where webhooks were missed.
   * Runs every 5 minutes.
   */
  @Cron("0 */5 * * * *")
  async checkForMissedDunningCandidates(): Promise<void> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      // Find open invoices past due that haven't entered dunning
      const candidates = await this.prisma.invoice.findMany({
        where: {
          status: "open",
          dueDate: { lt: oneHourAgo },
          dunningStartedAt: null,
          // Has a subscription (dunning is for recurring payments)
          subscriptionId: { not: null },
        },
        select: {
          id: true,
          workspaceId: true,
        },
        take: 20,
      });

      if (candidates.length === 0) {
        return;
      }

      this.logger.log(
        `Found ${candidates.length} invoices that may need dunning`,
      );

      for (const invoice of candidates) {
        try {
          await this.dunningService.startDunning(
            invoice.workspaceId,
            invoice.id,
          );
        } catch (error) {
          this.logger.warn(
            `Failed to start dunning for invoice ${invoice.id}: ${error}`,
          );
        }
      }
    } catch (error) {
      this.logger.error("Error checking for missed dunning candidates", error);
    }
  }

  /**
   * Clean up stale processing attempts.
   * If an attempt has been in "processing" state for more than 10 minutes,
   * reset it to "pending" for retry.
   * Runs every 10 minutes.
   */
  @Cron("0 */10 * * * *")
  async cleanupStaleAttempts(): Promise<void> {
    try {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

      const result = await this.prisma.dunningAttempt.updateMany({
        where: {
          status: "processing",
          executedAt: { lt: tenMinutesAgo },
        },
        data: {
          status: "pending",
          executedAt: null,
        },
      });

      if (result.count > 0) {
        this.logger.warn(`Reset ${result.count} stale processing attempts`);
      }
    } catch (error) {
      this.logger.error("Error cleaning up stale attempts", error);
    }
  }
}
