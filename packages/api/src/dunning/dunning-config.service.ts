import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import type { DunningConfig, DunningFinalAction, Prisma } from "@prisma/client";

export interface DunningConfigWithDefaults {
  id: string;
  workspaceId: string;
  retrySchedule: number[];
  maxAttempts: number;
  finalAction: DunningFinalAction;
  gracePeriodDays: number;
  emailsEnabled: boolean;
  fromEmail: string | null;
  fromName: string | null;
  replyToEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
  isDefault: boolean;
}

const DEFAULT_RETRY_SCHEDULE = [1, 3, 5, 7]; // Days after first failure
const DEFAULT_MAX_ATTEMPTS = 4;
const DEFAULT_FINAL_ACTION: DunningFinalAction = "suspend";
const DEFAULT_GRACE_PERIOD_DAYS = 0;

@Injectable()
export class DunningConfigService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get dunning configuration for a workspace, returning defaults if not configured.
   */
  async getConfig(workspaceId: string): Promise<DunningConfigWithDefaults> {
    const config = await this.prisma.dunningConfig.findUnique({
      where: { workspaceId },
    });

    if (config) {
      return { ...config, isDefault: false };
    }

    return this.getDefaultConfig(workspaceId);
  }

  /**
   * Get raw config without defaults (null if not configured).
   */
  async getRawConfig(workspaceId: string): Promise<DunningConfig | null> {
    return this.prisma.dunningConfig.findUnique({
      where: { workspaceId },
    });
  }

  /**
   * Create or update dunning configuration for a workspace.
   */
  async upsertConfig(
    workspaceId: string,
    data: Prisma.DunningConfigUpdateInput,
  ): Promise<DunningConfig> {
    return this.prisma.dunningConfig.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        retrySchedule:
          (data.retrySchedule as number[]) ?? DEFAULT_RETRY_SCHEDULE,
        maxAttempts: (data.maxAttempts as number) ?? DEFAULT_MAX_ATTEMPTS,
        finalAction:
          (data.finalAction as DunningFinalAction) ?? DEFAULT_FINAL_ACTION,
        gracePeriodDays:
          (data.gracePeriodDays as number) ?? DEFAULT_GRACE_PERIOD_DAYS,
        emailsEnabled: (data.emailsEnabled as boolean) ?? false,
        fromEmail: data.fromEmail as string | null,
        fromName: data.fromName as string | null,
        replyToEmail: data.replyToEmail as string | null,
      },
      update: data,
    });
  }

  /**
   * Delete dunning configuration, reverting to defaults.
   */
  async deleteConfig(workspaceId: string): Promise<void> {
    await this.prisma.dunningConfig.delete({
      where: { workspaceId },
    });
  }

  /**
   * Get default dunning configuration.
   */
  getDefaultConfig(workspaceId: string): DunningConfigWithDefaults {
    const now = new Date();
    return {
      id: "default",
      workspaceId,
      retrySchedule: DEFAULT_RETRY_SCHEDULE,
      maxAttempts: DEFAULT_MAX_ATTEMPTS,
      finalAction: DEFAULT_FINAL_ACTION,
      gracePeriodDays: DEFAULT_GRACE_PERIOD_DAYS,
      emailsEnabled: false,
      fromEmail: null,
      fromName: null,
      replyToEmail: null,
      createdAt: now,
      updatedAt: now,
      isDefault: true,
    };
  }

  /**
   * Calculate the next retry date based on the dunning schedule.
   * @param attemptNumber - The current attempt number (0-indexed)
   * @param firstFailureDate - The date of the first payment failure
   * @returns The scheduled date for the next retry, or null if no more retries
   */
  calculateNextRetryDate(
    config: DunningConfigWithDefaults,
    attemptNumber: number,
    firstFailureDate: Date,
  ): Date | null {
    const schedule = config.retrySchedule;

    if (attemptNumber >= schedule.length) {
      return null; // No more retries scheduled
    }

    const daysAfterFirst = schedule[attemptNumber];
    const nextDate = new Date(firstFailureDate);
    nextDate.setDate(nextDate.getDate() + daysAfterFirst);

    return nextDate;
  }

  /**
   * Check if all retry attempts have been exhausted.
   */
  isMaxAttemptsReached(
    config: DunningConfigWithDefaults,
    attemptCount: number,
  ): boolean {
    return attemptCount >= config.maxAttempts;
  }

  /**
   * Calculate the date when final action should be taken (after grace period).
   */
  calculateFinalActionDate(
    config: DunningConfigWithDefaults,
    lastAttemptDate: Date,
  ): Date {
    const finalDate = new Date(lastAttemptDate);
    finalDate.setDate(finalDate.getDate() + config.gracePeriodDays);
    return finalDate;
  }
}
