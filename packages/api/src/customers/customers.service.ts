import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { BillingService } from '../billing/billing.service';
import { ProviderRefService } from '../billing/provider-ref.service';
import type { Customer, Prisma } from '@prisma/client';
import type { PaginatedResult } from '@relay/database';

export interface CreateCustomerDto {
  email: string;
  name?: string;
  externalId?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateCustomerDto {
  email?: string;
  name?: string;
  externalId?: string;
  metadata?: Record<string, unknown>;
}

export interface CustomerQueryParams {
  limit: number;
  cursor?: string;
  email?: string;
  externalId?: string;
}

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
    private readonly providerRefService: ProviderRefService,
  ) {}

  async findById(workspaceId: string, id: string): Promise<Customer | null> {
    return this.prisma.customer.findFirst({
      where: { id, workspaceId },
    });
  }

  async findByEmail(workspaceId: string, email: string): Promise<Customer | null> {
    return this.prisma.customer.findFirst({
      where: { workspaceId, email },
    });
  }

  async findByExternalId(workspaceId: string, externalId: string): Promise<Customer | null> {
    return this.prisma.customer.findFirst({
      where: { workspaceId, externalId },
    });
  }

  async findMany(
    workspaceId: string,
    params: CustomerQueryParams
  ): Promise<PaginatedResult<Customer>> {
    const { limit, cursor, email, externalId } = params;

    const where: Prisma.CustomerWhereInput = {
      workspaceId,
      ...(email && { email: { contains: email, mode: 'insensitive' } }),
      ...(externalId && { externalId }),
    };

    const customers = await this.prisma.customer.findMany({
      where,
      take: limit + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
      orderBy: { createdAt: 'desc' },
    });

    const hasMore = customers.length > limit;
    const data = hasMore ? customers.slice(0, -1) : customers;
    const nextCursor = hasMore ? data[data.length - 1]?.id : null;

    return {
      data,
      hasMore,
      nextCursor: nextCursor ?? null,
    };
  }

  async create(workspaceId: string, dto: CreateCustomerDto): Promise<Customer> {
    // Check for duplicate email
    const existingByEmail = await this.findByEmail(workspaceId, dto.email);
    if (existingByEmail) {
      throw new ConflictException(`Customer with email '${dto.email}' already exists`);
    }

    // Check for duplicate externalId
    if (dto.externalId) {
      const existingByExternalId = await this.findByExternalId(workspaceId, dto.externalId);
      if (existingByExternalId) {
        throw new ConflictException(`Customer with externalId '${dto.externalId}' already exists`);
      }
    }

    const customer = await this.prisma.customer.create({
      data: {
        workspaceId,
        email: dto.email,
        name: dto.name,
        externalId: dto.externalId,
        metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });

    // Sync to Stripe
    await this.syncToStripe(workspaceId, customer);

    return customer;
  }

  private async syncToStripe(workspaceId: string, customer: Customer): Promise<void> {
    if (!this.billingService.isConfigured('stripe')) {
      this.logger.warn('Stripe not configured, skipping customer sync');
      return;
    }

    try {
      const stripeAdapter = this.billingService.getStripeAdapter();
      const result = await stripeAdapter.createCustomer({
        workspaceId,
        customerId: customer.id,
        email: customer.email,
        name: customer.name ?? undefined,
      });

      // Store provider ref
      await this.providerRefService.create({
        workspaceId,
        entityType: 'customer',
        entityId: customer.id,
        provider: 'stripe',
        externalId: result.externalId,
      });

      this.logger.log(`Synced customer ${customer.id} to Stripe as ${result.externalId}`);
    } catch (error) {
      this.logger.error(`Failed to sync customer ${customer.id} to Stripe: ${error}`);
      // Don't throw - customer is created locally, sync can be retried
    }
  }

  /**
   * Update a customer with optional optimistic concurrency control.
   *
   * @param workspaceId - Workspace ID
   * @param id - Customer ID
   * @param dto - Update data
   * @param requiredVersion - If provided, update will fail if current version doesn't match
   * @returns Updated customer with incremented version
   */
  async update(
    workspaceId: string,
    id: string,
    dto: UpdateCustomerDto,
    requiredVersion?: number
  ): Promise<Customer> {
    const customer = await this.findById(workspaceId, id);
    if (!customer) {
      throw new NotFoundException(`Customer ${id} not found`);
    }

    // Optimistic concurrency check
    if (requiredVersion !== undefined && customer.version !== requiredVersion) {
      throw new ConflictException(
        `Customer ${id} has been modified. Expected version ${requiredVersion}, current version ${customer.version}.`
      );
    }

    // Check for duplicate email
    if (dto.email && dto.email !== customer.email) {
      const existingByEmail = await this.findByEmail(workspaceId, dto.email);
      if (existingByEmail) {
        throw new ConflictException(`Customer with email '${dto.email}' already exists`);
      }
    }

    // Check for duplicate externalId
    if (dto.externalId && dto.externalId !== customer.externalId) {
      const existingByExternalId = await this.findByExternalId(workspaceId, dto.externalId);
      if (existingByExternalId) {
        throw new ConflictException(`Customer with externalId '${dto.externalId}' already exists`);
      }
    }

    const updatedCustomer = await this.prisma.customer.update({
      where: { id },
      data: {
        ...(dto.email && { email: dto.email }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.externalId !== undefined && { externalId: dto.externalId }),
        ...(dto.metadata && { metadata: dto.metadata as Prisma.InputJsonValue }),
        version: { increment: 1 },
      },
    });

    // Sync update to Stripe
    await this.updateInStripe(workspaceId, id, dto);

    return updatedCustomer;
  }

  private async updateInStripe(
    workspaceId: string,
    customerId: string,
    dto: UpdateCustomerDto
  ): Promise<void> {
    if (!this.billingService.isConfigured('stripe')) {
      return;
    }

    try {
      const stripeCustomerId = await this.providerRefService.getStripeCustomerId(
        workspaceId,
        customerId
      );

      if (!stripeCustomerId) {
        this.logger.warn(`No Stripe customer ID found for customer ${customerId}`);
        return;
      }

      const stripeAdapter = this.billingService.getStripeAdapter();
      await stripeAdapter.updateCustomer(stripeCustomerId, {
        email: dto.email,
        name: dto.name,
      });

      this.logger.log(`Updated Stripe customer ${stripeCustomerId}`);
    } catch (error) {
      this.logger.error(`Failed to update customer ${customerId} in Stripe: ${error}`);
    }
  }

  async delete(workspaceId: string, id: string): Promise<void> {
    const customer = await this.findById(workspaceId, id);
    if (!customer) {
      throw new NotFoundException(`Customer ${id} not found`);
    }

    // Delete from Stripe first
    await this.deleteFromStripe(workspaceId, id);

    await this.prisma.customer.delete({
      where: { id },
    });
  }

  private async deleteFromStripe(workspaceId: string, customerId: string): Promise<void> {
    if (!this.billingService.isConfigured('stripe')) {
      return;
    }

    try {
      const stripeCustomerId = await this.providerRefService.getStripeCustomerId(
        workspaceId,
        customerId
      );

      if (!stripeCustomerId) {
        return;
      }

      const stripeAdapter = this.billingService.getStripeAdapter();
      await stripeAdapter.deleteCustomer(stripeCustomerId);

      // Delete the provider ref
      await this.providerRefService.delete(workspaceId, 'customer', customerId, 'stripe');

      this.logger.log(`Deleted Stripe customer ${stripeCustomerId}`);
    } catch (error) {
      this.logger.error(`Failed to delete customer ${customerId} from Stripe: ${error}`);
    }
  }

  async getOrCreate(
    workspaceId: string,
    email: string,
    name?: string
  ): Promise<Customer> {
    const existing = await this.findByEmail(workspaceId, email);
    if (existing) {
      return existing;
    }

    return this.create(workspaceId, { email, name });
  }

  async createPortalSession(
    workspaceId: string,
    customerId: string,
    returnUrl: string
  ): Promise<{ id: string; url: string }> {
    // Verify customer exists
    const customer = await this.findById(workspaceId, customerId);
    if (!customer) {
      throw new NotFoundException(`Customer ${customerId} not found`);
    }

    // Get Stripe customer ID
    const stripeCustomerId = await this.providerRefService.getStripeCustomerId(
      workspaceId,
      customerId
    );

    if (!stripeCustomerId) {
      throw new NotFoundException(
        `Customer ${customerId} is not linked to Stripe. Customer must have an active subscription.`
      );
    }

    // Create portal session via Stripe
    const stripeAdapter = this.billingService.getStripeAdapter();
    const session = await stripeAdapter.createPortalSession({
      workspaceId,
      customerId: stripeCustomerId,
      returnUrl,
    });

    this.logger.log(`Created portal session for customer ${customerId}`);

    return {
      id: session.id,
      url: session.url,
    };
  }
}
