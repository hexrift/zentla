import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { EntitlementsService } from "./entitlements.service";

/**
 * A seat assignment represents a user's access to a feature.
 */
export interface SeatAssignment {
  id: string;
  workspaceId: string;
  customerId: string;
  featureKey: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  assignedAt: Date;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Summary of seat usage for a feature.
 */
export interface SeatUsageSummary {
  featureKey: string;
  totalSeats: number | null;
  usedSeats: number;
  availableSeats: number | null;
  isUnlimited: boolean;
  assignments: SeatAssignment[];
}

/**
 * Options for assigning a seat.
 */
export interface AssignSeatOptions {
  userEmail?: string;
  userName?: string;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class SeatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlementsService: EntitlementsService,
  ) {}

  /**
   * Assign a seat to a user for a specific feature.
   * Validates that the customer has enough available seats.
   */
  async assignSeat(
    workspaceId: string,
    customerId: string,
    featureKey: string,
    userId: string,
    options: AssignSeatOptions = {},
  ): Promise<SeatAssignment> {
    // Check if seat is already assigned
    const existingAssignment = await this.prisma.seatAssignment.findFirst({
      where: {
        workspaceId,
        customerId,
        featureKey,
        userId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    if (existingAssignment) {
      return this.toSeatAssignment(existingAssignment);
    }

    // Check entitlement and available seats
    const entitlement = await this.entitlementsService.checkEntitlement(
      workspaceId,
      customerId,
      featureKey,
    );

    if (!entitlement.hasAccess) {
      throw new BadRequestException(
        `Customer does not have entitlement for ${featureKey}`,
      );
    }

    // Get current seat count
    const usedSeats = await this.countUsedSeats(
      workspaceId,
      customerId,
      featureKey,
    );

    // Check seat limit (if numeric)
    if (
      entitlement.valueType === "number" &&
      typeof entitlement.value === "number"
    ) {
      if (usedSeats >= entitlement.value) {
        throw new BadRequestException(
          `No available seats for ${featureKey}. ${usedSeats}/${entitlement.value} seats used.`,
        );
      }
    }

    // Create seat assignment
    const assignment = await this.prisma.seatAssignment.create({
      data: {
        workspaceId,
        customerId,
        featureKey,
        userId,
        userEmail: options.userEmail,
        userName: options.userName,
        expiresAt: options.expiresAt,
        metadata: (options.metadata ?? {}) as object,
      },
    });

    return this.toSeatAssignment(assignment);
  }

  /**
   * Unassign a seat from a user.
   */
  async unassignSeat(
    workspaceId: string,
    customerId: string,
    featureKey: string,
    userId: string,
  ): Promise<void> {
    const result = await this.prisma.seatAssignment.deleteMany({
      where: {
        workspaceId,
        customerId,
        featureKey,
        userId,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException(
        `No seat assignment found for user ${userId} on ${featureKey}`,
      );
    }
  }

  /**
   * Unassign a specific seat by ID.
   */
  async unassignSeatById(
    workspaceId: string,
    assignmentId: string,
  ): Promise<void> {
    const result = await this.prisma.seatAssignment.deleteMany({
      where: {
        id: assignmentId,
        workspaceId,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException(`Seat assignment ${assignmentId} not found`);
    }
  }

  /**
   * Check if a user has a seat for a feature.
   */
  async hasSeat(
    workspaceId: string,
    customerId: string,
    featureKey: string,
    userId: string,
  ): Promise<boolean> {
    const assignment = await this.prisma.seatAssignment.findFirst({
      where: {
        workspaceId,
        customerId,
        featureKey,
        userId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    return assignment !== null;
  }

  /**
   * Get all seat assignments for a customer and feature.
   */
  async getAssignments(
    workspaceId: string,
    customerId: string,
    featureKey: string,
  ): Promise<SeatAssignment[]> {
    const assignments = await this.prisma.seatAssignment.findMany({
      where: {
        workspaceId,
        customerId,
        featureKey,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { assignedAt: "asc" },
    });

    return assignments.map((a) => this.toSeatAssignment(a));
  }

  /**
   * Get seat usage summary for a customer and feature.
   */
  async getSeatUsage(
    workspaceId: string,
    customerId: string,
    featureKey: string,
  ): Promise<SeatUsageSummary> {
    // Get entitlement
    const entitlement = await this.entitlementsService.checkEntitlement(
      workspaceId,
      customerId,
      featureKey,
    );

    // Get current assignments
    const assignments = await this.getAssignments(
      workspaceId,
      customerId,
      featureKey,
    );

    const usedSeats = assignments.length;
    let totalSeats: number | null = null;
    let isUnlimited = false;

    if (!entitlement.hasAccess) {
      return {
        featureKey,
        totalSeats: 0,
        usedSeats,
        availableSeats: 0,
        isUnlimited: false,
        assignments,
      };
    }

    if (
      entitlement.valueType === "unlimited" ||
      entitlement.value === Infinity
    ) {
      isUnlimited = true;
    } else if (typeof entitlement.value === "number") {
      totalSeats = entitlement.value;
    }

    const availableSeats = isUnlimited
      ? null
      : totalSeats !== null
        ? Math.max(0, totalSeats - usedSeats)
        : null;

    return {
      featureKey,
      totalSeats,
      usedSeats,
      availableSeats,
      isUnlimited,
      assignments,
    };
  }

  /**
   * Get all seat usage summaries for a customer.
   */
  async getAllSeatUsage(
    workspaceId: string,
    customerId: string,
  ): Promise<SeatUsageSummary[]> {
    // Get all numeric entitlements (seats are numeric)
    const customerEntitlements =
      await this.entitlementsService.getCustomerEntitlements(
        workspaceId,
        customerId,
      );

    const seatFeatures = customerEntitlements.entitlements.filter(
      (e) => e.valueType === "number" || e.valueType === "unlimited",
    );

    const summaries: SeatUsageSummary[] = [];

    for (const feature of seatFeatures) {
      const usage = await this.getSeatUsage(
        workspaceId,
        customerId,
        feature.featureKey,
      );
      summaries.push(usage);
    }

    return summaries;
  }

  /**
   * Bulk assign seats to multiple users.
   */
  async bulkAssignSeats(
    workspaceId: string,
    customerId: string,
    featureKey: string,
    users: Array<{
      userId: string;
      userEmail?: string;
      userName?: string;
    }>,
  ): Promise<{
    assigned: SeatAssignment[];
    errors: Array<{ userId: string; error: string }>;
  }> {
    const assigned: SeatAssignment[] = [];
    const errors: Array<{ userId: string; error: string }> = [];

    for (const user of users) {
      try {
        const assignment = await this.assignSeat(
          workspaceId,
          customerId,
          featureKey,
          user.userId,
          {
            userEmail: user.userEmail,
            userName: user.userName,
          },
        );
        assigned.push(assignment);
      } catch (error) {
        errors.push({
          userId: user.userId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return { assigned, errors };
  }

  /**
   * Bulk unassign seats from multiple users.
   */
  async bulkUnassignSeats(
    workspaceId: string,
    customerId: string,
    featureKey: string,
    userIds: string[],
  ): Promise<{
    unassigned: number;
    errors: Array<{ userId: string; error: string }>;
  }> {
    let unassigned = 0;
    const errors: Array<{ userId: string; error: string }> = [];

    for (const userId of userIds) {
      try {
        await this.unassignSeat(workspaceId, customerId, featureKey, userId);
        unassigned++;
      } catch (error) {
        errors.push({
          userId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return { unassigned, errors };
  }

  /**
   * Transfer a seat from one user to another.
   */
  async transferSeat(
    workspaceId: string,
    customerId: string,
    featureKey: string,
    fromUserId: string,
    toUserId: string,
    options: Omit<AssignSeatOptions, "expiresAt"> = {},
  ): Promise<SeatAssignment> {
    // Get the original assignment to preserve expiration
    const originalAssignment = await this.prisma.seatAssignment.findFirst({
      where: {
        workspaceId,
        customerId,
        featureKey,
        userId: fromUserId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    if (!originalAssignment) {
      throw new NotFoundException(
        `No seat assignment found for user ${fromUserId}`,
      );
    }

    // Check if target user already has seat
    const existingSeat = await this.hasSeat(
      workspaceId,
      customerId,
      featureKey,
      toUserId,
    );

    if (existingSeat) {
      throw new BadRequestException(
        `User ${toUserId} already has a seat for ${featureKey}`,
      );
    }

    // Perform transfer in transaction
    await this.prisma.$transaction(async (tx) => {
      // Remove from original user
      await tx.seatAssignment.delete({
        where: { id: originalAssignment.id },
      });

      // Assign to new user
      await tx.seatAssignment.create({
        data: {
          workspaceId,
          customerId,
          featureKey,
          userId: toUserId,
          userEmail: options.userEmail,
          userName: options.userName,
          expiresAt: originalAssignment.expiresAt,
          metadata: (options.metadata ?? {}) as object,
        },
      });
    });

    // Get the new assignment
    const newAssignment = await this.prisma.seatAssignment.findFirst({
      where: {
        workspaceId,
        customerId,
        featureKey,
        userId: toUserId,
      },
    });

    return this.toSeatAssignment(newAssignment!);
  }

  /**
   * Revoke all seats for a subscription when it's canceled.
   */
  async revokeAllSeats(
    workspaceId: string,
    customerId: string,
    featureKey?: string,
  ): Promise<number> {
    const where: Record<string, unknown> = {
      workspaceId,
      customerId,
    };

    if (featureKey) {
      where.featureKey = featureKey;
    }

    const result = await this.prisma.seatAssignment.deleteMany({ where });
    return result.count;
  }

  private async countUsedSeats(
    workspaceId: string,
    customerId: string,
    featureKey: string,
  ): Promise<number> {
    return this.prisma.seatAssignment.count({
      where: {
        workspaceId,
        customerId,
        featureKey,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
  }

  private toSeatAssignment(dbAssignment: {
    id: string;
    workspaceId: string;
    customerId: string;
    featureKey: string;
    userId: string;
    userEmail: string | null;
    userName: string | null;
    assignedAt: Date;
    expiresAt: Date | null;
    metadata: unknown;
  }): SeatAssignment {
    return {
      id: dbAssignment.id,
      workspaceId: dbAssignment.workspaceId,
      customerId: dbAssignment.customerId,
      featureKey: dbAssignment.featureKey,
      userId: dbAssignment.userId,
      userEmail: dbAssignment.userEmail ?? undefined,
      userName: dbAssignment.userName ?? undefined,
      assignedAt: dbAssignment.assignedAt,
      expiresAt: dbAssignment.expiresAt ?? undefined,
      metadata: (dbAssignment.metadata as Record<string, unknown>) ?? undefined,
    };
  }
}
