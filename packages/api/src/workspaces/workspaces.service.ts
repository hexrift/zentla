import {
  Injectable,
  NotFoundException,
  ConflictException,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { BillingService } from "../billing/billing.service";
import type { Workspace, Prisma } from "@prisma/client";

export interface CreateWorkspaceDto {
  name: string;
  slug: string;
  defaultProvider?: "stripe" | "zuora";
  defaultCurrency?: string;
}

export interface UpdateWorkspaceDto {
  name?: string;
  defaultProvider?: "stripe" | "zuora";
  settings?: Partial<WorkspaceSettings>;
}

export interface WorkspaceSettings {
  defaultCurrency?: string;
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;
  webhookRetryPolicy?: {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
  };
}

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => BillingService))
    private readonly billingService: BillingService,
  ) {}

  async findById(id: string): Promise<Workspace | null> {
    return this.prisma.workspace.findUnique({
      where: { id },
    });
  }

  async findBySlug(slug: string): Promise<Workspace | null> {
    return this.prisma.workspace.findUnique({
      where: { slug },
    });
  }

  async create(dto: CreateWorkspaceDto): Promise<Workspace> {
    const existing = await this.findBySlug(dto.slug);
    if (existing) {
      throw new ConflictException(
        `Workspace with slug '${dto.slug}' already exists`,
      );
    }

    const settings: WorkspaceSettings = {
      defaultCurrency: dto.defaultCurrency ?? "USD",
      webhookRetryPolicy: {
        maxRetries: 5,
        initialDelayMs: 1000,
        maxDelayMs: 300000,
        backoffMultiplier: 2,
      },
    };

    return this.prisma.workspace.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        defaultProvider: dto.defaultProvider ?? "stripe",
        settings: settings as Prisma.InputJsonValue,
      },
    });
  }

  async update(id: string, dto: UpdateWorkspaceDto): Promise<Workspace> {
    const workspace = await this.findById(id);
    if (!workspace) {
      throw new NotFoundException(`Workspace ${id} not found`);
    }

    const currentSettings = workspace.settings as WorkspaceSettings;
    const newSettings = dto.settings
      ? { ...currentSettings, ...dto.settings }
      : currentSettings;

    const updated = await this.prisma.workspace.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.defaultProvider && { defaultProvider: dto.defaultProvider }),
        settings: newSettings as Prisma.InputJsonValue,
      },
    });

    // Reconfigure billing service if Stripe credentials were updated
    if (dto.settings?.stripeSecretKey || dto.settings?.stripeWebhookSecret) {
      // Clear any cached provider for this workspace
      this.billingService.clearWorkspaceCache(id);

      const settings = updated.settings as WorkspaceSettings;
      if (settings.stripeSecretKey && settings.stripeWebhookSecret) {
        this.billingService.configureProviderForWorkspace(id, "stripe", {
          secretKey: settings.stripeSecretKey,
          webhookSecret: settings.stripeWebhookSecret,
        });
      }
    }

    return updated;
  }

  async delete(id: string): Promise<void> {
    const workspace = await this.findById(id);
    if (!workspace) {
      throw new NotFoundException(`Workspace ${id} not found`);
    }

    await this.prisma.workspace.delete({
      where: { id },
    });
  }
}
