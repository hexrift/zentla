import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { ResendProvider } from "../email/providers/resend.provider";
import { randomBytes, createHash } from "crypto";

export interface PortalCustomer {
  id: string;
  email: string;
  name: string | null;
}

export interface PortalSubscription {
  id: string;
  status: string;
  offer: {
    id: string;
    name: string;
  };
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAt: Date | null;
  createdAt: Date;
}

export interface PortalInvoice {
  id: string;
  amountDue: number;
  amountPaid: number;
  total: number;
  currency: string;
  status: string;
  periodStart: Date | null;
  periodEnd: Date | null;
  dueDate: Date | null;
  paidAt: Date | null;
  providerInvoiceUrl: string | null;
  createdAt: Date;
}

export interface PortalEntitlement {
  featureKey: string;
  value: unknown;
  valueType: string;
}

@Injectable()
export class CustomerPortalService {
  private readonly logger = new Logger(CustomerPortalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly resendProvider: ResendProvider,
  ) {}

  /**
   * Generate a magic link token for customer authentication.
   */
  private generateToken(): string {
    return randomBytes(32).toString("hex");
  }

  /**
   * Hash a token for secure storage.
   */
  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  /**
   * Request a magic link for customer portal access.
   */
  async requestMagicLink(
    workspaceId: string,
    email: string,
    portalBaseUrl: string,
  ): Promise<{ success: boolean }> {
    // Find customer by email
    const customer = await this.prisma.customer.findFirst({
      where: { workspaceId, email },
    });

    if (!customer) {
      // Don't reveal if email exists or not
      return { success: true };
    }

    // Generate magic link token
    const rawToken = this.generateToken();
    const hashedToken = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Store magic link
    await this.prisma.customerPortalMagicLink.create({
      data: {
        workspaceId,
        customerId: customer.id,
        token: hashedToken,
        expiresAt,
      },
    });

    // Get workspace name for email
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    });

    // Build magic link URL
    const magicLinkUrl = `${portalBaseUrl}/portal/verify?token=${rawToken}&workspace=${workspaceId}`;

    // Send email
    const result = await this.resendProvider.send({
      to: email,
      subject: `Your login link for ${workspace?.name ?? "Customer Portal"}`,
      html: `
        <h2>Sign in to your account</h2>
        <p>Click the button below to access your customer portal:</p>
        <p style="margin: 24px 0;">
          <a href="${magicLinkUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Sign in to Portal
          </a>
        </p>
        <p style="color: #6B7280; font-size: 14px;">
          This link expires in 15 minutes. If you didn't request this link, you can safely ignore this email.
        </p>
        <p style="color: #9CA3AF; font-size: 12px; margin-top: 24px;">
          Can't click the button? Copy and paste this URL into your browser:<br/>
          ${magicLinkUrl}
        </p>
      `,
      text: `Sign in to your customer portal:\n\n${magicLinkUrl}\n\nThis link expires in 15 minutes.`,
    });

    if (!result.success) {
      this.logger.warn(
        `Failed to send magic link email to ${email}: ${result.error}`,
      );
    }

    return { success: true };
  }

  /**
   * Verify a magic link and create a session.
   */
  async verifyMagicLink(
    workspaceId: string,
    rawToken: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ sessionToken: string; customer: PortalCustomer }> {
    const hashedToken = this.hashToken(rawToken);

    // Find magic link
    const magicLink = await this.prisma.customerPortalMagicLink.findFirst({
      where: {
        workspaceId,
        token: hashedToken,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!magicLink) {
      throw new UnauthorizedException("Invalid or expired link");
    }

    // Mark magic link as used
    await this.prisma.customerPortalMagicLink.update({
      where: { id: magicLink.id },
      data: { usedAt: new Date() },
    });

    // Get customer
    const customer = await this.prisma.customer.findUnique({
      where: { id: magicLink.customerId },
      select: { id: true, email: true, name: true },
    });

    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    // Create session
    const sessionToken = this.generateToken();
    const sessionHash = this.hashToken(sessionToken);
    const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.prisma.customerPortalSession.create({
      data: {
        workspaceId,
        customerId: customer.id,
        token: sessionHash,
        expiresAt: sessionExpiresAt,
        ipAddress,
        userAgent,
      },
    });

    return {
      sessionToken,
      customer: {
        id: customer.id,
        email: customer.email,
        name: customer.name,
      },
    };
  }

  /**
   * Validate a session token and return customer info.
   */
  async validateSession(
    workspaceId: string,
    sessionToken: string,
  ): Promise<{ customerId: string; customer: PortalCustomer }> {
    const hashedToken = this.hashToken(sessionToken);

    const session = await this.prisma.customerPortalSession.findFirst({
      where: {
        workspaceId,
        token: hashedToken,
        expiresAt: { gt: new Date() },
      },
    });

    if (!session) {
      throw new UnauthorizedException("Invalid or expired session");
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id: session.customerId },
      select: { id: true, email: true, name: true },
    });

    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    return {
      customerId: session.customerId,
      customer: {
        id: customer.id,
        email: customer.email,
        name: customer.name,
      },
    };
  }

  /**
   * Logout - invalidate session.
   */
  async logout(workspaceId: string, sessionToken: string): Promise<void> {
    const hashedToken = this.hashToken(sessionToken);

    await this.prisma.customerPortalSession.deleteMany({
      where: {
        workspaceId,
        token: hashedToken,
      },
    });
  }

  /**
   * Get customer's subscriptions.
   */
  async getSubscriptions(
    workspaceId: string,
    customerId: string,
  ): Promise<PortalSubscription[]> {
    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        workspaceId,
        customerId,
      },
      orderBy: { createdAt: "desc" },
      include: {
        offer: {
          select: { id: true, name: true },
        },
      },
    });

    return subscriptions.map((sub) => ({
      id: sub.id,
      status: sub.status,
      offer: {
        id: sub.offer.id,
        name: sub.offer.name,
      },
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: sub.currentPeriodEnd,
      cancelAt: sub.cancelAt,
      createdAt: sub.createdAt,
    }));
  }

  /**
   * Get customer's invoices.
   */
  async getInvoices(
    workspaceId: string,
    customerId: string,
    limit: number = 20,
  ): Promise<PortalInvoice[]> {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        workspaceId,
        customerId,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return invoices.map((inv) => ({
      id: inv.id,
      amountDue: inv.amountDue,
      amountPaid: inv.amountPaid,
      total: inv.total,
      currency: inv.currency,
      status: inv.status,
      periodStart: inv.periodStart,
      periodEnd: inv.periodEnd,
      dueDate: inv.dueDate,
      paidAt: inv.paidAt,
      providerInvoiceUrl: inv.providerInvoiceUrl,
      createdAt: inv.createdAt,
    }));
  }

  /**
   * Get customer's entitlements.
   */
  async getEntitlements(
    workspaceId: string,
    customerId: string,
  ): Promise<PortalEntitlement[]> {
    const entitlements = await this.prisma.entitlement.findMany({
      where: {
        workspaceId,
        customerId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { featureKey: "asc" },
    });

    return entitlements.map((ent) => ({
      featureKey: ent.featureKey,
      value: ent.value,
      valueType: ent.valueType,
    }));
  }

  /**
   * Cancel subscription at period end.
   */
  async cancelSubscription(
    workspaceId: string,
    customerId: string,
    subscriptionId: string,
  ): Promise<PortalSubscription> {
    // Verify subscription belongs to customer
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        workspaceId,
        customerId,
      },
      include: {
        offer: { select: { id: true, name: true } },
      },
    });

    if (!subscription) {
      throw new NotFoundException("Subscription not found");
    }

    // Set cancelAt to the end of the current period
    const updated = await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { cancelAt: subscription.currentPeriodEnd },
      include: {
        offer: { select: { id: true, name: true } },
      },
    });

    return {
      id: updated.id,
      status: updated.status,
      offer: {
        id: updated.offer.id,
        name: updated.offer.name,
      },
      currentPeriodStart: updated.currentPeriodStart,
      currentPeriodEnd: updated.currentPeriodEnd,
      cancelAt: updated.cancelAt,
      createdAt: updated.createdAt,
    };
  }

  /**
   * Reactivate a subscription that was set to cancel.
   */
  async reactivateSubscription(
    workspaceId: string,
    customerId: string,
    subscriptionId: string,
  ): Promise<PortalSubscription> {
    // Verify subscription belongs to customer and is scheduled to cancel
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        workspaceId,
        customerId,
        status: "active",
        cancelAt: { not: null },
      },
      include: {
        offer: { select: { id: true, name: true } },
      },
    });

    if (!subscription) {
      throw new NotFoundException("Subscription not found or not canceling");
    }

    // Clear cancelAt to reactivate
    const updated = await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { cancelAt: null },
      include: {
        offer: { select: { id: true, name: true } },
      },
    });

    return {
      id: updated.id,
      status: updated.status,
      offer: {
        id: updated.offer.id,
        name: updated.offer.name,
      },
      currentPeriodStart: updated.currentPeriodStart,
      currentPeriodEnd: updated.currentPeriodEnd,
      cancelAt: updated.cancelAt,
      createdAt: updated.createdAt,
    };
  }
}
