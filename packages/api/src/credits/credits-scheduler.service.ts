import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { CreditsService } from "./credits.service";

@Injectable()
export class CreditsSchedulerService {
  private readonly logger = new Logger(CreditsSchedulerService.name);
  private isProcessing = false;

  constructor(private readonly creditsService: CreditsService) {}

  /**
   * Expires credits that have passed their expiration date.
   * Runs every hour.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async expireCredits(): Promise<void> {
    if (this.isProcessing) {
      this.logger.debug("Already processing credit expiration, skipping");
      return;
    }

    this.isProcessing = true;

    try {
      const expiredCount = await this.creditsService.expireCredits();
      if (expiredCount > 0) {
        this.logger.log(`Expired ${expiredCount} credits`);
      }
    } catch (error) {
      this.logger.error(`Failed to expire credits: ${error}`);
    } finally {
      this.isProcessing = false;
    }
  }
}
