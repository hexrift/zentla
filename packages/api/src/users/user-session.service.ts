import { Injectable } from "@nestjs/common";
import { randomBytes, createHash } from "crypto";
import { PrismaService } from "../database/prisma.service";
import type { UserSession } from "@zentla/database";

const SESSION_TOKEN_LENGTH = 32;
const SESSION_PREFIX = "relay_session_";
const DEFAULT_SESSION_DURATION_DAYS = 30;

export interface SessionContext {
  userId: string;
  sessionId: string;
}

export interface CreateSessionDto {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
  durationDays?: number;
}

@Injectable()
export class UserSessionService {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(
    dto: CreateSessionDto,
  ): Promise<{ token: string; session: UserSession }> {
    const rawToken = randomBytes(SESSION_TOKEN_LENGTH).toString("hex");
    const token = `${SESSION_PREFIX}${rawToken}`;
    const tokenHash = this.hashToken(token);

    const durationDays = dto.durationDays ?? DEFAULT_SESSION_DURATION_DAYS;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    const session = await this.prisma.userSession.create({
      data: {
        userId: dto.userId,
        token: tokenHash,
        expiresAt,
        ipAddress: dto.ipAddress,
        userAgent: dto.userAgent,
      },
    });

    return { token, session };
  }

  async validateSession(token: string): Promise<SessionContext | null> {
    if (!token.startsWith(SESSION_PREFIX)) {
      return null;
    }

    const tokenHash = this.hashToken(token);

    const session = await this.prisma.userSession.findUnique({
      where: { token: tokenHash },
    });

    if (!session) {
      return null;
    }

    // Check expiration
    if (session.expiresAt < new Date()) {
      // Clean up expired session
      await this.revokeSession(session.id);
      return null;
    }

    return {
      userId: session.userId,
      sessionId: session.id,
    };
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.prisma.userSession
      .delete({
        where: { id: sessionId },
      })
      .catch(() => {
        // Ignore if already deleted
      });
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    await this.prisma.userSession.deleteMany({
      where: { userId },
    });
  }

  async listUserSessions(userId: string): Promise<UserSession[]> {
    return this.prisma.userSession.findMany({
      where: {
        userId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.prisma.userSession.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
    return result.count;
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}
