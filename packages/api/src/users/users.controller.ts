import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
} from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Request } from 'express';
import { UsersService } from './users.service';
import { UserSessionService } from './user-session.service';
import { Public, CurrentSession, type SessionContext } from '../common/decorators';

// ============================================================================
// REQUEST DTOs
// ============================================================================

class SignupRequestDto {
  @ApiProperty({
    description: 'Email address for the new account',
    example: 'developer@example.com',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: 'Password (minimum 8 characters)',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({
    description: 'Display name',
    example: 'Jane Developer',
  })
  @IsOptional()
  @IsString()
  name?: string;
}

class LoginRequestDto {
  @ApiProperty({
    description: 'Email address',
    example: 'developer@example.com',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: 'Password',
  })
  @IsString()
  password!: string;
}

class GitHubCallbackDto {
  @ApiProperty({
    description: 'GitHub OAuth code from callback',
  })
  @IsString()
  code!: string;
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
  };
  workspaces: Array<{
    id: string;
    name: string;
    slug: string;
    role: string;
    mode: string;
  }>;
  session: {
    token: string;
    expiresAt: string;
  };
  initialApiKey?: {
    id: string;
    secret: string;
    prefix: string;
    message: string;
  };
}

// ============================================================================
// CONTROLLER
// ============================================================================

@ApiTags('auth')
@Controller('auth')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly sessionService: UserSessionService
  ) {}

  @Post('signup')
  @Public()
  @ApiOperation({
    summary: 'Create a new account',
    description: `Creates a new user account with email and password.

**What happens on signup:**
- A new user account is created
- A default workspace is automatically created for the user
- The user becomes the owner of their workspace
- A session token is returned for authentication

**Workspace defaults:**
- Mode: test (live mode requires explicit request)
- Provider: Stripe
- Currency: USD`,
  })
  @ApiResponse({
    status: 201,
    description: 'Account created successfully',
    schema: {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string', nullable: true },
            avatarUrl: { type: 'string', nullable: true },
          },
        },
        workspaces: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              slug: { type: 'string' },
              role: { type: 'string', enum: ['owner', 'admin'] },
              mode: { type: 'string', enum: ['test', 'live'] },
            },
          },
        },
        session: {
          type: 'object',
          properties: {
            token: { type: 'string' },
            expiresAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request (e.g., invalid email format, password too short)',
  })
  @ApiResponse({
    status: 409,
    description: 'Email already registered',
  })
  async signup(
    @Body() dto: SignupRequestDto,
    @Req() req: Request
  ): Promise<AuthResponse> {
    const { user, initialApiKey } = await this.usersService.signup({
      email: dto.email,
      password: dto.password,
      name: dto.name,
    });

    const { token, session } = await this.sessionService.createSession({
      userId: user.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    const response: AuthResponse = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
      workspaces: user.memberships.map((m) => ({
        id: m.workspace.id,
        name: m.workspace.name,
        slug: m.workspace.slug,
        role: m.role,
        mode: m.workspace.mode,
      })),
      session: {
        token,
        expiresAt: session.expiresAt.toISOString(),
      },
    };

    if (initialApiKey) {
      response.initialApiKey = {
        id: initialApiKey.id,
        secret: initialApiKey.secret,
        prefix: initialApiKey.prefix,
        message: 'Store this API key securely. It will not be shown again.',
      };
    }

    return response;
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Log in with email and password',
    description: `Authenticates a user and returns a session token.

**Session token usage:**
Include the token in the \`Authorization\` header for dashboard API calls:
\`\`\`
Authorization: Bearer relay_session_...
\`\`\`

**Session duration:**
Sessions are valid for 30 days by default.`,
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid email or password',
  })
  async login(
    @Body() dto: LoginRequestDto,
    @Req() req: Request
  ): Promise<AuthResponse> {
    const user = await this.usersService.login({
      email: dto.email,
      password: dto.password,
    });

    const { token, session } = await this.sessionService.createSession({
      userId: user.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
      workspaces: user.memberships.map((m) => ({
        id: m.workspace.id,
        name: m.workspace.name,
        slug: m.workspace.slug,
        role: m.role,
        mode: m.workspace.mode,
      })),
      session: {
        token,
        expiresAt: session.expiresAt.toISOString(),
      },
    };
  }

  @Get('github')
  @Public()
  @ApiOperation({
    summary: 'Get GitHub OAuth URL',
    description: 'Returns the URL to redirect users to for GitHub OAuth authentication.',
  })
  @ApiResponse({
    status: 200,
    description: 'GitHub OAuth URL',
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string', format: 'uri' },
      },
    },
  })
  getGitHubAuthUrl(): { url: string } {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const redirectUri = process.env.GITHUB_REDIRECT_URI || 'http://localhost:3002/api/v1/auth/github/callback';

    if (!clientId) {
      throw new Error('GitHub OAuth is not configured');
    }

    const url = new URL('https://github.com/login/oauth/authorize');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', 'user:email');
    url.searchParams.set('allow_signup', 'true');

    return { url: url.toString() };
  }

  @Post('github/callback')
  @Public()
  @ApiOperation({
    summary: 'GitHub OAuth callback',
    description: 'Handles the GitHub OAuth callback and creates/links an account.',
  })
  @ApiResponse({
    status: 200,
    description: 'GitHub authentication successful',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid OAuth code',
  })
  async handleGitHubCallback(
    @Body() dto: GitHubCallbackDto,
    @Req() req: Request
  ): Promise<AuthResponse> {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('GitHub OAuth is not configured');
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: dto.code,
      }),
    });

    const tokenData = await tokenResponse.json() as { access_token?: string; error?: string };

    if (!tokenData.access_token) {
      throw new Error('Failed to exchange GitHub code for token');
    }

    // Get user info from GitHub
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    const githubUser = await userResponse.json() as {
      id: number;
      email: string | null;
      name: string | null;
      avatar_url: string | null;
    };

    // Get email if not public
    let email = githubUser.email;
    if (!email) {
      const emailsResponse = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      const emails = await emailsResponse.json() as Array<{
        email: string;
        primary: boolean;
        verified: boolean;
      }>;

      const primaryEmail = emails.find((e) => e.primary && e.verified);
      email = primaryEmail?.email || emails[0]?.email;
    }

    if (!email) {
      throw new Error('Could not get email from GitHub');
    }

    // Create or link user
    const { user, initialApiKey } = await this.usersService.signupWithGitHub({
      githubId: String(githubUser.id),
      email,
      name: githubUser.name || undefined,
      avatarUrl: githubUser.avatar_url || undefined,
    });

    const { token, session } = await this.sessionService.createSession({
      userId: user.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    const response: AuthResponse = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
      workspaces: user.memberships.map((m) => ({
        id: m.workspace.id,
        name: m.workspace.name,
        slug: m.workspace.slug,
        role: m.role,
        mode: m.workspace.mode,
      })),
      session: {
        token,
        expiresAt: session.expiresAt.toISOString(),
      },
    };

    if (initialApiKey) {
      response.initialApiKey = {
        id: initialApiKey.id,
        secret: initialApiKey.secret,
        prefix: initialApiKey.prefix,
        message: 'Store this API key securely. It will not be shown again.',
      };
    }

    return response;
  }

  @Get('me')
  @ApiOperation({
    summary: 'Get current user',
    description: 'Returns the currently authenticated user and their workspaces.',
  })
  @ApiHeader({
    name: 'Authorization',
    description: 'Session token: Bearer relay_session_...',
  })
  @ApiResponse({
    status: 200,
    description: 'Current user information',
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated',
  })
  async getCurrentUser(@CurrentSession() session: SessionContext) {
    const user = await this.usersService.findById(session.userId);
    if (!user) {
      return { error: 'User not found' };
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
      workspaces: user.memberships.map((m) => ({
        id: m.workspace.id,
        name: m.workspace.name,
        slug: m.workspace.slug,
        role: m.role,
        mode: m.workspace.mode,
      })),
    };
  }

  @Delete('session')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Log out',
    description: 'Invalidates the current session token.',
  })
  @ApiResponse({
    status: 204,
    description: 'Logged out successfully',
  })
  async logout(@CurrentSession() session: SessionContext): Promise<void> {
    await this.sessionService.revokeSession(session.sessionId);
  }
}
