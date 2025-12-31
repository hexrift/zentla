import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from "@nestjs/common";
import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { PrismaService } from "../database/prisma.service";
import { WorkspacesService } from "../workspaces/workspaces.service";
import {
  ApiKeyService,
  type GeneratedApiKey,
} from "../auth/services/api-key.service";
import type { User, WorkspaceRole, WorkspaceMode } from "@relay/database";

const scryptAsync = promisify(scrypt);

export interface SignupDto {
  email: string;
  password: string;
  name?: string;
}

export interface SignupWithGitHubDto {
  githubId: string;
  email: string;
  name?: string;
  avatarUrl?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface UserWithWorkspaces {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  passwordHash: string | null;
  githubId: string | null;
  googleId: string | null;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  memberships: Array<{
    id: string;
    role: WorkspaceRole;
    workspace: {
      id: string;
      name: string;
      slug: string;
      mode: WorkspaceMode;
    };
  }>;
}

export interface SignupResult {
  user: UserWithWorkspaces;
  initialApiKey?: GeneratedApiKey;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspacesService: WorkspacesService,
    private readonly apiKeyService: ApiKeyService,
  ) {}

  async signup(dto: SignupDto): Promise<SignupResult> {
    // Check if user already exists
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException("A user with this email already exists");
    }

    // Hash password
    const passwordHash = await this.hashPassword(dto.password);

    // Generate workspace slug from email
    const baseSlug = this.generateSlugFromEmail(dto.email);
    const slug = await this.ensureUniqueSlug(baseSlug);

    // Create user with workspace and membership in a transaction
    const { user, workspaceId } = await this.prisma.$transaction(async (tx) => {
      // Create user
      const newUser = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          name: dto.name || dto.email.split("@")[0],
          passwordHash,
        },
      });

      // Create default workspace for user (in test mode)
      const workspace = await tx.workspace.create({
        data: {
          name: `${dto.name || dto.email.split("@")[0]}'s Workspace`,
          slug,
          defaultProvider: "stripe",
          mode: "test",
          settings: {
            defaultCurrency: "USD",
            webhookRetryPolicy: {
              maxRetries: 5,
              initialDelayMs: 1000,
              maxDelayMs: 300000,
              backoffMultiplier: 2,
            },
          },
        },
      });

      // Create membership with owner role
      await tx.workspaceMembership.create({
        data: {
          userId: newUser.id,
          workspaceId: workspace.id,
          role: "owner",
        },
      });

      // Return user with memberships
      const userWithMemberships = await tx.user.findUnique({
        where: { id: newUser.id },
        include: {
          memberships: {
            include: {
              workspace: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  mode: true,
                },
              },
            },
          },
        },
      });

      return { user: userWithMemberships, workspaceId: workspace.id };
    });

    // Generate initial test API key for the new workspace
    const initialApiKey = await this.apiKeyService.generateApiKey(
      workspaceId,
      "Default Test Key",
      "admin",
      "test",
    );

    return {
      user: user as UserWithWorkspaces,
      initialApiKey,
    };
  }

  async signupWithGitHub(dto: SignupWithGitHubDto): Promise<SignupResult> {
    // Check if user exists by GitHub ID
    const existingUser = await this.prisma.user.findUnique({
      where: { githubId: dto.githubId },
      include: {
        memberships: {
          include: {
            workspace: {
              select: {
                id: true,
                name: true,
                slug: true,
                mode: true,
              },
            },
          },
        },
      },
    });

    if (existingUser) {
      // Existing GitHub user, return with workspaces (no new API key)
      return { user: existingUser as UserWithWorkspaces };
    }

    // Check if email is already used by another account
    const existingByEmail = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingByEmail) {
      // Link GitHub to existing account (no new API key)
      const linkedUser = await this.prisma.user.update({
        where: { id: existingByEmail.id },
        data: {
          githubId: dto.githubId,
          avatarUrl: dto.avatarUrl || existingByEmail.avatarUrl,
        },
        include: {
          memberships: {
            include: {
              workspace: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  mode: true,
                },
              },
            },
          },
        },
      });

      return { user: linkedUser as UserWithWorkspaces };
    }

    // New user via GitHub
    const baseSlug = this.generateSlugFromEmail(dto.email);
    const slug = await this.ensureUniqueSlug(baseSlug);

    const { user, workspaceId } = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          name: dto.name || dto.email.split("@")[0],
          githubId: dto.githubId,
          avatarUrl: dto.avatarUrl,
          emailVerifiedAt: new Date(), // GitHub emails are verified
        },
      });

      const workspace = await tx.workspace.create({
        data: {
          name: `${dto.name || dto.email.split("@")[0]}'s Workspace`,
          slug,
          defaultProvider: "stripe",
          mode: "test",
          settings: {
            defaultCurrency: "USD",
            webhookRetryPolicy: {
              maxRetries: 5,
              initialDelayMs: 1000,
              maxDelayMs: 300000,
              backoffMultiplier: 2,
            },
          },
        },
      });

      await tx.workspaceMembership.create({
        data: {
          userId: newUser.id,
          workspaceId: workspace.id,
          role: "owner",
        },
      });

      const userWithMemberships = await tx.user.findUnique({
        where: { id: newUser.id },
        include: {
          memberships: {
            include: {
              workspace: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  mode: true,
                },
              },
            },
          },
        },
      });

      return { user: userWithMemberships, workspaceId: workspace.id };
    });

    // Generate initial test API key for new GitHub user
    const initialApiKey = await this.apiKeyService.generateApiKey(
      workspaceId,
      "Default Test Key",
      "admin",
      "test",
    );

    return {
      user: user as UserWithWorkspaces,
      initialApiKey,
    };
  }

  async login(dto: LoginDto): Promise<UserWithWorkspaces> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: {
        memberships: {
          include: {
            workspace: {
              select: {
                id: true,
                name: true,
                slug: true,
                mode: true,
              },
            },
          },
        },
      },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const isValid = await this.verifyPassword(dto.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException("Invalid email or password");
    }

    return user as UserWithWorkspaces;
  }

  async findById(id: string): Promise<UserWithWorkspaces | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        memberships: {
          include: {
            workspace: {
              select: {
                id: true,
                name: true,
                slug: true,
                mode: true,
              },
            },
          },
        },
      },
    });

    return user as UserWithWorkspaces | null;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString("hex");
    const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${salt}:${derivedKey.toString("hex")}`;
  }

  private async verifyPassword(
    password: string,
    storedHash: string,
  ): Promise<boolean> {
    const [salt, hash] = storedHash.split(":");
    const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
    const storedKey = Buffer.from(hash, "hex");
    return timingSafeEqual(derivedKey, storedKey);
  }

  private generateSlugFromEmail(email: string): string {
    const localPart = email.split("@")[0];
    return localPart
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 30);
  }

  private async ensureUniqueSlug(baseSlug: string): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (await this.workspacesService.findBySlug(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }
}
