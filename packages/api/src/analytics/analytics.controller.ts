import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
} from "@nestjs/common";
import {
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiQuery,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from "@nestjs/swagger";
import type { RevenueEventType, SnapshotPeriod } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import { MemberOnly, WorkspaceId } from "../common/decorators";
import { RevenueAnalyticsService } from "./revenue-analytics.service";

// ============================================================================
// REQUEST DTOs
// ============================================================================

class GetRevenueTrendDto {
  @ApiProperty({
    description: "Start date for the trend data (ISO 8601 format)",
    example: "2024-01-01",
  })
  @IsDateString()
  startDate!: string;

  @ApiProperty({
    description: "End date for the trend data (ISO 8601 format)",
    example: "2024-12-31",
  })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional({
    description: "Aggregation period for the trend data",
    enum: ["daily", "monthly"],
    default: "daily",
  })
  @IsOptional()
  @IsString()
  period?: "daily" | "monthly";
}

class GetCohortAnalysisDto {
  @ApiPropertyOptional({
    description:
      "Start month for cohort analysis (ISO 8601 format). Defaults to 12 months ago.",
    example: "2024-01-01",
  })
  @IsOptional()
  @IsDateString()
  startMonth?: string;

  @ApiPropertyOptional({
    description: "Number of cohort months to include",
    default: 12,
    minimum: 1,
    maximum: 24,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  months?: number;
}

class GetPeriodComparisonDto {
  @ApiProperty({
    description: "Start of current period (ISO 8601 format)",
    example: "2024-06-01",
  })
  @IsDateString()
  currentStart!: string;

  @ApiProperty({
    description: "End of current period (ISO 8601 format)",
    example: "2024-06-30",
  })
  @IsDateString()
  currentEnd!: string;

  @ApiProperty({
    description: "Start of previous period for comparison (ISO 8601 format)",
    example: "2024-05-01",
  })
  @IsDateString()
  previousStart!: string;

  @ApiProperty({
    description: "End of previous period for comparison (ISO 8601 format)",
    example: "2024-05-31",
  })
  @IsDateString()
  previousEnd!: string;
}

class GetRevenueEventsDto {
  @ApiPropertyOptional({
    description: "Filter by customer ID",
  })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({
    description: "Filter by subscription ID",
  })
  @IsOptional()
  @IsString()
  subscriptionId?: string;

  @ApiPropertyOptional({
    description: "Filter by event type",
    enum: [
      "new_subscription",
      "trial_converted",
      "upgrade",
      "downgrade",
      "cancellation",
      "reactivation",
    ],
  })
  @IsOptional()
  @IsString()
  type?: RevenueEventType;

  @ApiPropertyOptional({
    description: "Start date filter (ISO 8601 format)",
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: "End date filter (ISO 8601 format)",
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: "Maximum number of events to return",
    default: 100,
    minimum: 1,
    maximum: 1000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;
}

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

class MrrBreakdownSchema {
  @ApiProperty({ description: "Total MRR movement", example: 50000 })
  total!: number;

  @ApiProperty({ description: "New subscription MRR", example: 30000 })
  new!: number;

  @ApiProperty({ description: "Expansion MRR from upgrades", example: 10000 })
  expansion!: number;

  @ApiProperty({
    description: "Contraction MRR from downgrades",
    example: 5000,
  })
  contraction!: number;

  @ApiProperty({ description: "Churned MRR from cancellations", example: 8000 })
  churned!: number;

  @ApiProperty({ description: "Reactivation MRR", example: 3000 })
  reactivation!: number;

  @ApiProperty({ description: "Net new MRR", example: 30000 })
  netNew!: number;
}

class CustomerMetricsSchema {
  @ApiProperty({ description: "Total customers in workspace", example: 150 })
  total!: number;

  @ApiProperty({
    description: "Customers with active subscriptions",
    example: 120,
  })
  active!: number;

  @ApiProperty({ description: "New customers this period", example: 15 })
  new!: number;

  @ApiProperty({ description: "Churned customers this period", example: 5 })
  churned!: number;

  @ApiProperty({
    description: "Reactivated customers this period",
    example: 2,
  })
  reactivated!: number;
}

class RevenueMetricsSchema {
  @ApiProperty({
    description: "Monthly Recurring Revenue in cents",
    example: 125000,
  })
  mrr!: number;

  @ApiProperty({
    description: "Annual Recurring Revenue in cents (MRR × 12)",
    example: 1500000,
  })
  arr!: number;

  @ApiProperty({ description: "MRR breakdown by component" })
  mrrBreakdown!: MrrBreakdownSchema;

  @ApiProperty({ description: "Customer metrics" })
  customers!: CustomerMetricsSchema;

  @ApiProperty({
    description: "Monthly churn rate in basis points (e.g., 250 = 2.5%)",
    example: 250,
  })
  churnRate!: number;

  @ApiProperty({
    description:
      "Net Revenue Retention in basis points (e.g., 11500 = 115%). Includes expansion.",
    example: 11500,
  })
  netRevenueRetention!: number;

  @ApiProperty({
    description:
      "Gross Revenue Retention in basis points (e.g., 9500 = 95%). Excludes expansion.",
    example: 9500,
  })
  grossRevenueRetention!: number;

  @ApiProperty({
    description: "Average Revenue Per User in cents",
    example: 10416,
  })
  arpu!: number;

  @ApiProperty({
    description: "Estimated Customer Lifetime Value in cents",
    example: 416640,
  })
  ltv!: number;

  @ApiProperty({ description: "Currency code", example: "usd" })
  currency!: string;
}

class RevenueTrendPointSchema {
  @ApiProperty({ description: "Date of the data point" })
  date!: Date;

  @ApiProperty({ description: "MRR on this date in cents" })
  mrr!: number;

  @ApiProperty({ description: "ARR on this date in cents" })
  arr!: number;

  @ApiProperty({
    description: "Number of active customers/subscriptions on this date",
  })
  customers!: number;

  @ApiProperty({
    description: "Churn rate as a decimal (e.g., 0.025 = 2.5%)",
  })
  churnRate!: number;
}

class TopCustomerSchema {
  @ApiProperty({ description: "Customer ID" })
  customerId!: string;

  @ApiProperty({ description: "Customer email address" })
  customerEmail!: string;

  @ApiProperty({ description: "Customer MRR in cents" })
  mrr!: number;

  @ApiProperty({ description: "Number of active subscriptions" })
  subscriptionCount!: number;
}

// ============================================================================
// CONTROLLER
// ============================================================================

@ApiTags("analytics")
@ApiSecurity("api-key")
@Controller("analytics")
@MemberOnly()
export class AnalyticsController {
  constructor(
    private readonly revenueAnalyticsService: RevenueAnalyticsService,
  ) {}

  @Get("metrics")
  @ApiOperation({
    summary: "Get current revenue metrics",
    description: `Returns comprehensive real-time revenue metrics for the workspace.

**Metrics included:**
- **MRR/ARR**: Monthly and Annual Recurring Revenue
- **MRR Breakdown**: New, expansion, contraction, churned, reactivation
- **Customer Metrics**: Total, active, new, churned, reactivated
- **Retention Rates**: Net Revenue Retention (NRR) and Gross Revenue Retention (GRR)
- **Unit Economics**: ARPU and LTV estimates

**Note:** All monetary values are in cents. Rates are in basis points (e.g., 11500 = 115%).`,
  })
  @ApiResponse({
    status: 200,
    description: "Current revenue metrics",
    type: RevenueMetricsSchema,
  })
  async getCurrentMetrics(
    @WorkspaceId() workspaceId: string,
  ): Promise<RevenueMetricsSchema> {
    return this.revenueAnalyticsService.getCurrentMetrics(workspaceId);
  }

  @Get("trend")
  @ApiOperation({
    summary: "Get revenue trend over time",
    description: `Returns historical MRR, ARR, and customer counts over a date range.

**Use cases:**
- Revenue growth charts
- Trend analysis
- Seasonal pattern identification

**Periods:**
- \`daily\`: One data point per day (best for <90 day ranges)
- \`monthly\`: One data point per month (best for >90 day ranges)

**Note:** Requires revenue snapshots to be created. If no snapshots exist for a period, those dates will be missing from the response.`,
  })
  @ApiResponse({
    status: 200,
    description: "Revenue trend data points",
    type: [RevenueTrendPointSchema],
  })
  async getRevenueTrend(
    @WorkspaceId() workspaceId: string,
    @Query() query: GetRevenueTrendDto,
  ): Promise<RevenueTrendPointSchema[]> {
    return this.revenueAnalyticsService.getRevenueTrend(
      workspaceId,
      new Date(query.startDate),
      new Date(query.endDate),
      (query.period as SnapshotPeriod) || "daily",
    );
  }

  @Get("cohorts")
  @ApiOperation({
    summary: "Get cohort analysis data",
    description: `Returns customer and revenue retention data organized by acquisition cohort.

**Cohort Definition:** Customers are grouped by the month they first subscribed.

**For each cohort, tracks:**
- Number of customers acquired
- Customer retention rate over time
- Revenue retention rate over time

**Use cases:**
- Identify retention trends
- Measure impact of product changes
- Forecast future retention

**Note:** Retention rates are in basis points (e.g., 8500 = 85% retention).`,
  })
  @ApiResponse({
    status: 200,
    description: "Cohort analysis data",
  })
  async getCohortAnalysis(
    @WorkspaceId() workspaceId: string,
    @Query() query: GetCohortAnalysisDto,
  ) {
    const startMonth = query.startMonth
      ? new Date(query.startMonth)
      : new Date(new Date().getFullYear(), new Date().getMonth() - 12, 1);

    return this.revenueAnalyticsService.getCohortAnalysis(
      workspaceId,
      startMonth,
      query.months ?? 12,
    );
  }

  @Get("comparison")
  @ApiOperation({
    summary: "Get period-over-period comparison",
    description: `Compares revenue metrics between two time periods.

**Returns:**
- Current period metrics
- Previous period metrics
- Percentage change for key metrics

**Common comparisons:**
- Month-over-Month (MoM)
- Year-over-Year (YoY)
- Quarter-over-Quarter (QoQ)

**Example:** Compare June 2024 to May 2024:
- currentStart: 2024-06-01
- currentEnd: 2024-06-30
- previousStart: 2024-05-01
- previousEnd: 2024-05-31`,
  })
  @ApiResponse({
    status: 200,
    description: "Period comparison with changes",
  })
  async getPeriodComparison(
    @WorkspaceId() workspaceId: string,
    @Query() query: GetPeriodComparisonDto,
  ) {
    return this.revenueAnalyticsService.getPeriodComparison(
      workspaceId,
      new Date(query.currentStart),
      new Date(query.currentEnd),
      new Date(query.previousStart),
      new Date(query.previousEnd),
    );
  }

  @Get("top-customers")
  @ApiOperation({
    summary: "Get top customers by MRR",
    description: `Returns the highest-value customers ranked by their Monthly Recurring Revenue.

**Use cases:**
- VIP customer identification
- Account prioritization
- Concentration risk analysis

**Note:** Only includes customers with active subscriptions.`,
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Number of customers to return (default: 10, max: 100)",
  })
  @ApiResponse({
    status: 200,
    description: "Top customers by MRR",
    type: [TopCustomerSchema],
  })
  async getTopCustomers(
    @WorkspaceId() workspaceId: string,
    @Query("limit", new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<TopCustomerSchema[]> {
    return this.revenueAnalyticsService.getTopCustomers(
      workspaceId,
      Math.min(limit, 100),
    );
  }

  @Get("events")
  @ApiOperation({
    summary: "Get revenue events",
    description: `Returns raw revenue events for the workspace.

**Event types:**
- \`new_subscription\`: Customer started a new subscription
- \`trial_converted\`: Trial converted to paid
- \`upgrade\`: Customer upgraded to a higher plan
- \`downgrade\`: Customer downgraded to a lower plan
- \`cancellation\`: Subscription was cancelled
- \`reactivation\`: Previously cancelled customer resubscribed

**Use cases:**
- Audit trail for revenue changes
- Debugging MRR discrepancies
- Custom analytics and exports`,
  })
  @ApiResponse({
    status: 200,
    description: "List of revenue events",
  })
  async getRevenueEvents(
    @WorkspaceId() workspaceId: string,
    @Query() query: GetRevenueEventsDto,
  ) {
    return this.revenueAnalyticsService.getRevenueEvents(workspaceId, {
      customerId: query.customerId,
      subscriptionId: query.subscriptionId,
      type: query.type,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      limit: query.limit,
    });
  }
}
