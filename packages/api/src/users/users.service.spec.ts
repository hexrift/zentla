import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { UsersService } from "./users.service";
import { PrismaService } from "../database/prisma.service";
import { WorkspacesService } from "../workspaces/workspaces.service";
import { ApiKeyService } from "../auth/services/api-key.service";

describe("UsersService", () => {
  let service: UsersService;
  let prisma: {
    user: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    workspace: {
      create: ReturnType<typeof vi.fn>;
    };
    workspaceMembership: {
      create: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let workspacesService: {
    findBySlug: ReturnType<typeof vi.fn>;
  };
  let apiKeyService: {
    generateApiKey: ReturnType<typeof vi.fn>;
  };

  const mockUser = {
    id: "user_123",
    email: "test@example.com",
    name: "Test User",
    avatarUrl: null,
    passwordHash: null,
    githubId: null,
    googleId: null,
    emailVerifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    memberships: [
      {
        id: "mem_123",
        role: "owner" as const,
        workspace: {
          id: "ws_123",
          name: "Test Workspace",
          slug: "test",
          mode: "test" as const,
        },
      },
    ],
  };

  const mockApiKey = {
    id: "key_123",
    secret: "relay_test_abc123",
    prefix: "relay_test_abc",
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      workspace: {
        create: vi.fn(),
      },
      workspaceMembership: {
        create: vi.fn(),
      },
      $transaction: vi.fn((fn) =>
        fn({
          user: prisma.user,
          workspace: prisma.workspace,
          workspaceMembership: prisma.workspaceMembership,
        }),
      ),
    };

    workspacesService = {
      findBySlug: vi.fn().mockResolvedValue(null),
    };

    apiKeyService = {
      generateApiKey: vi.fn().mockResolvedValue(mockApiKey),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: WorkspacesService, useValue: workspacesService },
        { provide: ApiKeyService, useValue: apiKeyService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe("signup", () => {
    it("should throw ConflictException if email already exists", async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.signup({
          email: "test@example.com",
          password: "password123",
        }),
      ).rejects.toThrow(ConflictException);
    });

    it("should create user with workspace and return initial API key", async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(null) // First check for existing user
        .mockResolvedValueOnce(mockUser); // Return user with memberships after creation

      prisma.user.create.mockResolvedValue({
        id: "user_123",
        email: "test@example.com",
      });
      prisma.workspace.create.mockResolvedValue({
        id: "ws_123",
        name: "Test Workspace",
        slug: "test",
      });
      prisma.workspaceMembership.create.mockResolvedValue({});

      const result = await service.signup({
        email: "test@example.com",
        password: "password123",
        name: "Test User",
      });

      expect(result.user).toBeDefined();
      expect(result.initialApiKey).toEqual(mockApiKey);
      expect(apiKeyService.generateApiKey).toHaveBeenCalledWith(
        "ws_123",
        "Default Test Key",
        "admin",
        "test",
      );
    });

    it("should normalize email to lowercase", async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockUser);
      prisma.user.create.mockResolvedValue({ id: "user_123" });
      prisma.workspace.create.mockResolvedValue({ id: "ws_123" });
      prisma.workspaceMembership.create.mockResolvedValue({});

      await service.signup({
        email: "TEST@Example.COM",
        password: "password123",
      });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: "test@example.com" },
      });
    });

    it("should generate unique slug if base slug exists", async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockUser);
      prisma.user.create.mockResolvedValue({ id: "user_123" });
      prisma.workspace.create.mockResolvedValue({ id: "ws_123" });
      prisma.workspaceMembership.create.mockResolvedValue({});

      // First call returns existing workspace, second returns null
      workspacesService.findBySlug
        .mockResolvedValueOnce({ id: "existing" })
        .mockResolvedValueOnce(null);

      await service.signup({
        email: "test@example.com",
        password: "password123",
      });

      expect(workspacesService.findBySlug).toHaveBeenCalledTimes(2);
    });
  });

  describe("signupWithGitHub", () => {
    it("should return existing user if GitHub ID already linked", async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.signupWithGitHub({
        githubId: "github_123",
        email: "test@example.com",
        name: "Test User",
      });

      expect(result.user).toEqual(mockUser);
      expect(result.initialApiKey).toBeUndefined();
    });

    it("should link GitHub to existing email account", async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(null) // No user with GitHub ID
        .mockResolvedValueOnce({ id: "user_123", email: "test@example.com" }); // Email exists

      prisma.user.update.mockResolvedValue({
        ...mockUser,
        githubId: "github_123",
      });

      const result = await service.signupWithGitHub({
        githubId: "github_123",
        email: "test@example.com",
        name: "Test User",
      });

      expect(result.user.githubId).toBe("github_123");
      expect(result.initialApiKey).toBeUndefined();
    });

    it("should create new user with workspace for new GitHub signup", async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(null) // No user with GitHub ID
        .mockResolvedValueOnce(null) // No user with email
        .mockResolvedValueOnce(mockUser); // Return after creation

      prisma.user.create.mockResolvedValue({ id: "user_123" });
      prisma.workspace.create.mockResolvedValue({ id: "ws_123" });
      prisma.workspaceMembership.create.mockResolvedValue({});

      const result = await service.signupWithGitHub({
        githubId: "github_123",
        email: "new@example.com",
        name: "New User",
        avatarUrl: "https://avatar.url",
      });

      expect(result.user).toBeDefined();
      expect(result.initialApiKey).toEqual(mockApiKey);
    });
  });

  describe("login", () => {
    it("should throw UnauthorizedException for non-existent user", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({
          email: "nonexistent@example.com",
          password: "password123",
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should throw UnauthorizedException for user without password", async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        passwordHash: null, // GitHub/OAuth user
      });

      await expect(
        service.login({
          email: "test@example.com",
          password: "password123",
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should throw UnauthorizedException for wrong password", async () => {
      // Create a valid hash format (salt is 32 hex chars, hash is 128 hex chars for 64 bytes)
      const salt = "a".repeat(32);
      const hash = "b".repeat(128);
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        passwordHash: `${salt}:${hash}`,
      });

      await expect(
        service.login({
          email: "test@example.com",
          password: "wrongpassword",
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("findById", () => {
    it("should return user with workspaces when found", async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findById("user_123");

      expect(result).toEqual(mockUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: "user_123" },
        include: expect.objectContaining({
          memberships: expect.any(Object),
        }),
      });
    });

    it("should return null when user not found", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.findById("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("findByEmail", () => {
    it("should return user when found", async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findByEmail("test@example.com");

      expect(result).toEqual(mockUser);
    });

    it("should normalize email to lowercase", async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await service.findByEmail("TEST@Example.COM");

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: "test@example.com" },
      });
    });
  });
});
