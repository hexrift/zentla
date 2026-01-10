import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Headers,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Req,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiParam,
} from "@nestjs/swagger";
import { CustomerPortalService } from "./customer-portal.service";
import { CustomersService } from "../customers/customers.service";
import { IsEmail, IsString, IsUrl } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { Request } from "express";

// ============================================================================
// REQUEST DTOs
// ============================================================================

class RequestMagicLinkDto {
  @ApiProperty({
    description: "Customer's email address",
    example: "customer@example.com",
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: "Workspace ID the customer belongs to",
  })
  @IsString()
  workspaceId!: string;

  @ApiProperty({
    description: "Base URL for the portal (used to build magic link)",
    example: "https://app.example.com",
  })
  @IsUrl()
  portalBaseUrl!: string;
}

class VerifyMagicLinkDto {
  @ApiProperty({
    description: "Magic link token from email",
  })
  @IsString()
  token!: string;

  @ApiProperty({
    description: "Workspace ID",
  })
  @IsString()
  workspaceId!: string;
}

class CreateBillingPortalDto {
  @ApiProperty({
    description: "URL to redirect to after leaving the billing portal",
    example: "https://app.example.com/portal",
  })
  @IsUrl()
  returnUrl!: string;
}

// ============================================================================
// CONTROLLER
// ============================================================================

@ApiTags("customer-portal")
@Controller("portal")
export class CustomerPortalController {
  constructor(
    private readonly portalService: CustomerPortalService,
    private readonly customersService: CustomersService,
  ) {}

  @Post("request-magic-link")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Request magic link",
    description: `Sends a magic link to the customer's email for portal authentication.

The link expires in 15 minutes. For security, the response is always successful even if the email doesn't exist.`,
  })
  @ApiResponse({
    status: 200,
    description: "Magic link sent (or silently ignored if email not found)",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean" },
      },
    },
  })
  async requestMagicLink(@Body() dto: RequestMagicLinkDto) {
    return this.portalService.requestMagicLink(
      dto.workspaceId,
      dto.email,
      dto.portalBaseUrl,
    );
  }

  @Post("verify")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Verify magic link",
    description: `Verifies the magic link token and creates a session.

Returns a session token to be used for subsequent authenticated requests.`,
  })
  @ApiResponse({
    status: 200,
    description: "Session created",
    schema: {
      type: "object",
      properties: {
        sessionToken: { type: "string" },
        customer: {
          type: "object",
          properties: {
            id: { type: "string" },
            email: { type: "string" },
            name: { type: "string", nullable: true },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Invalid or expired token" })
  async verifyMagicLink(@Body() dto: VerifyMagicLinkDto, @Req() req: Request) {
    return this.portalService.verifyMagicLink(
      dto.workspaceId,
      dto.token,
      req.ip,
      req.headers["user-agent"],
    );
  }

  @Get("me")
  @ApiOperation({
    summary: "Get current customer",
    description: "Returns the authenticated customer's information.",
  })
  @ApiHeader({
    name: "X-Portal-Token",
    description: "Customer portal session token",
    required: true,
  })
  @ApiHeader({
    name: "X-Workspace-Id",
    description: "Workspace ID",
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: "Customer information",
    schema: {
      type: "object",
      properties: {
        id: { type: "string" },
        email: { type: "string" },
        name: { type: "string", nullable: true },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Invalid or expired session" })
  async getMe(
    @Headers("x-portal-token") token: string,
    @Headers("x-workspace-id") workspaceId: string,
  ) {
    if (!token || !workspaceId) {
      throw new UnauthorizedException("Missing authentication");
    }
    const { customer } = await this.portalService.validateSession(
      workspaceId,
      token,
    );
    return customer;
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Logout",
    description: "Invalidates the current session.",
  })
  @ApiHeader({
    name: "X-Portal-Token",
    description: "Customer portal session token",
    required: true,
  })
  @ApiHeader({
    name: "X-Workspace-Id",
    description: "Workspace ID",
    required: true,
  })
  @ApiResponse({ status: 204, description: "Logged out successfully" })
  async logout(
    @Headers("x-portal-token") token: string,
    @Headers("x-workspace-id") workspaceId: string,
  ) {
    if (!token || !workspaceId) {
      return;
    }
    await this.portalService.logout(workspaceId, token);
  }

  @Get("subscriptions")
  @ApiOperation({
    summary: "Get subscriptions",
    description: "Returns the customer's subscriptions.",
  })
  @ApiHeader({
    name: "X-Portal-Token",
    description: "Customer portal session token",
    required: true,
  })
  @ApiHeader({
    name: "X-Workspace-Id",
    description: "Workspace ID",
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: "List of subscriptions",
  })
  @ApiResponse({ status: 401, description: "Invalid or expired session" })
  async getSubscriptions(
    @Headers("x-portal-token") token: string,
    @Headers("x-workspace-id") workspaceId: string,
  ) {
    if (!token || !workspaceId) {
      throw new UnauthorizedException("Missing authentication");
    }
    const { customerId } = await this.portalService.validateSession(
      workspaceId,
      token,
    );
    return this.portalService.getSubscriptions(workspaceId, customerId);
  }

  @Post("subscriptions/:id/cancel")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Cancel subscription",
    description: "Cancels the subscription at the end of the current period.",
  })
  @ApiHeader({
    name: "X-Portal-Token",
    description: "Customer portal session token",
    required: true,
  })
  @ApiHeader({
    name: "X-Workspace-Id",
    description: "Workspace ID",
    required: true,
  })
  @ApiParam({ name: "id", description: "Subscription ID" })
  @ApiResponse({
    status: 200,
    description: "Subscription marked for cancellation",
  })
  @ApiResponse({ status: 401, description: "Invalid or expired session" })
  @ApiResponse({ status: 404, description: "Subscription not found" })
  async cancelSubscription(
    @Headers("x-portal-token") token: string,
    @Headers("x-workspace-id") workspaceId: string,
    @Param("id", ParseUUIDPipe) subscriptionId: string,
  ) {
    if (!token || !workspaceId) {
      throw new UnauthorizedException("Missing authentication");
    }
    const { customerId } = await this.portalService.validateSession(
      workspaceId,
      token,
    );
    return this.portalService.cancelSubscription(
      workspaceId,
      customerId,
      subscriptionId,
    );
  }

  @Post("subscriptions/:id/reactivate")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Reactivate subscription",
    description: "Reactivates a subscription that was set to cancel.",
  })
  @ApiHeader({
    name: "X-Portal-Token",
    description: "Customer portal session token",
    required: true,
  })
  @ApiHeader({
    name: "X-Workspace-Id",
    description: "Workspace ID",
    required: true,
  })
  @ApiParam({ name: "id", description: "Subscription ID" })
  @ApiResponse({
    status: 200,
    description: "Subscription reactivated",
  })
  @ApiResponse({ status: 401, description: "Invalid or expired session" })
  @ApiResponse({ status: 404, description: "Subscription not found" })
  async reactivateSubscription(
    @Headers("x-portal-token") token: string,
    @Headers("x-workspace-id") workspaceId: string,
    @Param("id", ParseUUIDPipe) subscriptionId: string,
  ) {
    if (!token || !workspaceId) {
      throw new UnauthorizedException("Missing authentication");
    }
    const { customerId } = await this.portalService.validateSession(
      workspaceId,
      token,
    );
    return this.portalService.reactivateSubscription(
      workspaceId,
      customerId,
      subscriptionId,
    );
  }

  @Get("invoices")
  @ApiOperation({
    summary: "Get invoices",
    description: "Returns the customer's invoice history.",
  })
  @ApiHeader({
    name: "X-Portal-Token",
    description: "Customer portal session token",
    required: true,
  })
  @ApiHeader({
    name: "X-Workspace-Id",
    description: "Workspace ID",
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: "List of invoices",
  })
  @ApiResponse({ status: 401, description: "Invalid or expired session" })
  async getInvoices(
    @Headers("x-portal-token") token: string,
    @Headers("x-workspace-id") workspaceId: string,
  ) {
    if (!token || !workspaceId) {
      throw new UnauthorizedException("Missing authentication");
    }
    const { customerId } = await this.portalService.validateSession(
      workspaceId,
      token,
    );
    return this.portalService.getInvoices(workspaceId, customerId);
  }

  @Get("entitlements")
  @ApiOperation({
    summary: "Get entitlements",
    description: "Returns the customer's feature entitlements.",
  })
  @ApiHeader({
    name: "X-Portal-Token",
    description: "Customer portal session token",
    required: true,
  })
  @ApiHeader({
    name: "X-Workspace-Id",
    description: "Workspace ID",
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: "List of entitlements",
  })
  @ApiResponse({ status: 401, description: "Invalid or expired session" })
  async getEntitlements(
    @Headers("x-portal-token") token: string,
    @Headers("x-workspace-id") workspaceId: string,
  ) {
    if (!token || !workspaceId) {
      throw new UnauthorizedException("Missing authentication");
    }
    const { customerId } = await this.portalService.validateSession(
      workspaceId,
      token,
    );
    return this.portalService.getEntitlements(workspaceId, customerId);
  }

  @Post("billing-portal")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Create billing portal session",
    description: `Creates a session for the billing provider's customer portal.

Redirects to Stripe/Zuora for payment method management.`,
  })
  @ApiHeader({
    name: "X-Portal-Token",
    description: "Customer portal session token",
    required: true,
  })
  @ApiHeader({
    name: "X-Workspace-Id",
    description: "Workspace ID",
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: "Billing portal session created",
    schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to redirect customer to" },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Invalid or expired session" })
  async createBillingPortal(
    @Headers("x-portal-token") token: string,
    @Headers("x-workspace-id") workspaceId: string,
    @Body() dto: CreateBillingPortalDto,
  ) {
    if (!token || !workspaceId) {
      throw new UnauthorizedException("Missing authentication");
    }
    const { customerId } = await this.portalService.validateSession(
      workspaceId,
      token,
    );
    const session = await this.customersService.createPortalSession(
      workspaceId,
      customerId,
      dto.returnUrl,
    );
    return { url: session.url };
  }
}
