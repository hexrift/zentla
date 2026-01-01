import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { UserSessionService } from "./user-session.service";

describe("UsersController", () => {
  let controller: UsersController;
  let usersService: {
    signup: ReturnType<typeof vi.fn>;
    login: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    signupWithGitHub: ReturnType<typeof vi.fn>;
  };
  let sessionService: {
    createSession: ReturnType<typeof vi.fn>;
    revokeSession: ReturnType<typeof vi.fn>;
  };

  const mockUser = {
    id: "user_123",
    email: "test@example.com",
    name: "Test User",
    avatarUrl: null,
    memberships: [
      {
        role: "owner",
        workspace: {
          id: "ws_123",
          name: "Test Workspace",
          slug: "test-workspace",
          mode: "test",
        },
      },
    ],
  };

  const mockSession = {
    id: "sess_123",
    expiresAt: new Date(Date.now() + 86400000),
  };

  const mockRequest = {
    ip: "127.0.0.1",
    get: vi.fn().mockReturnValue("Mozilla/5.0"),
  };

  beforeEach(async () => {
    usersService = {
      signup: vi.fn(),
      login: vi.fn(),
      findById: vi.fn(),
      signupWithGitHub: vi.fn(),
    };

    sessionService = {
      createSession: vi.fn(),
      revokeSession: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: usersService },
        { provide: UserSessionService, useValue: sessionService },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  describe("signup", () => {
    it("should create user and return session", async () => {
      usersService.signup.mockResolvedValue({ user: mockUser });
      sessionService.createSession.mockResolvedValue({
        token: "relay_session_abc123",
        session: mockSession,
      });

      const result = await controller.signup(
        { email: "test@example.com", password: "password123" },
        mockRequest as never,
      );

      expect(result.user.email).toBe("test@example.com");
      expect(result.session.token).toBe("relay_session_abc123");
      expect(result.workspaces).toHaveLength(1);
    });

    it("should include initial API key when provided", async () => {
      usersService.signup.mockResolvedValue({
        user: mockUser,
        initialApiKey: {
          id: "key_123",
          secret: "relay_live_secret",
          prefix: "relay_live",
        },
      });
      sessionService.createSession.mockResolvedValue({
        token: "relay_session_abc123",
        session: mockSession,
      });

      const result = await controller.signup(
        { email: "test@example.com", password: "password123" },
        mockRequest as never,
      );

      expect(result.initialApiKey).toBeDefined();
      expect(result.initialApiKey?.id).toBe("key_123");
      expect(result.initialApiKey?.message).toContain("Store this API key");
    });

    it("should include optional name in signup", async () => {
      usersService.signup.mockResolvedValue({ user: mockUser });
      sessionService.createSession.mockResolvedValue({
        token: "relay_session_abc123",
        session: mockSession,
      });

      await controller.signup(
        {
          email: "test@example.com",
          password: "password123",
          name: "Jane Doe",
        },
        mockRequest as never,
      );

      expect(usersService.signup).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "password123",
        name: "Jane Doe",
      });
    });
  });

  describe("login", () => {
    it("should authenticate user and return session", async () => {
      usersService.login.mockResolvedValue(mockUser);
      sessionService.createSession.mockResolvedValue({
        token: "relay_session_abc123",
        session: mockSession,
      });

      const result = await controller.login(
        { email: "test@example.com", password: "password123" },
        mockRequest as never,
      );

      expect(result.user.email).toBe("test@example.com");
      expect(result.session.token).toBe("relay_session_abc123");
    });

    it("should capture IP and user agent", async () => {
      usersService.login.mockResolvedValue(mockUser);
      sessionService.createSession.mockResolvedValue({
        token: "relay_session_abc123",
        session: mockSession,
      });

      await controller.login(
        { email: "test@example.com", password: "password123" },
        mockRequest as never,
      );

      expect(sessionService.createSession).toHaveBeenCalledWith({
        userId: "user_123",
        ipAddress: "127.0.0.1",
        userAgent: "Mozilla/5.0",
      });
    });
  });

  describe("getGitHubAuthUrl", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("should return GitHub OAuth URL", () => {
      process.env.GITHUB_CLIENT_ID = "test_client_id";
      process.env.GITHUB_REDIRECT_URI = "http://localhost:3002/callback";

      const result = controller.getGitHubAuthUrl();

      expect(result.url).toContain("github.com/login/oauth/authorize");
      expect(result.url).toContain("client_id=test_client_id");
    });

    it("should throw when GitHub not configured", () => {
      delete process.env.GITHUB_CLIENT_ID;

      expect(() => controller.getGitHubAuthUrl()).toThrow(
        "GitHub OAuth is not configured",
      );
    });

    it("should use default redirect URI when not specified", () => {
      process.env.GITHUB_CLIENT_ID = "test_client_id";
      delete process.env.GITHUB_REDIRECT_URI;

      const result = controller.getGitHubAuthUrl();

      // URL encoded - localhost:3002 becomes localhost%3A3002
      expect(result.url).toContain("localhost%3A3002");
    });
  });

  describe("getCurrentUser", () => {
    it("should return user info", async () => {
      usersService.findById.mockResolvedValue(mockUser);

      const result = await controller.getCurrentUser({
        userId: "user_123",
        sessionId: "sess_123",
        expiresAt: new Date(),
      });

      expect(result.user?.email).toBe("test@example.com");
      expect(result.workspaces).toHaveLength(1);
    });

    it("should return error when user not found", async () => {
      usersService.findById.mockResolvedValue(null);

      const result = await controller.getCurrentUser({
        userId: "user_123",
        sessionId: "sess_123",
        expiresAt: new Date(),
      });

      expect(result).toEqual({ error: "User not found" });
    });
  });

  describe("logout", () => {
    it("should revoke session", async () => {
      sessionService.revokeSession.mockResolvedValue(undefined);

      await controller.logout({
        userId: "user_123",
        sessionId: "sess_123",
        expiresAt: new Date(),
      });

      expect(sessionService.revokeSession).toHaveBeenCalledWith("sess_123");
    });
  });
});
