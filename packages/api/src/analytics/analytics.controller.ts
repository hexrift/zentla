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
import { DunningAnalyticsService } from "./dunning-analytics.service";

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

class GetDunningAnalyticsDto {
  @ApiPropertyOptional({
    description: "Start date for the analytics period (ISO 8601 format)",
    example: "2024-01-01",
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: "End date for the analytics period (ISO 8601 format)",
    example: "2024-12-31",
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

class GetDunningTrendDto {
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
    enum: ["daily", "weekly", "monthly"],
    default: "daily",
  })
  @IsOptional()
  @IsString()
  period?: "daily" | "weekly" | "monthly";
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

class AmountByCurrencySchema {
  @ApiProperty({ description: "Currency code", example: "usd" })
  currency!: string;

  @ApiProperty({ description: "Amount in cents", example: 50000 })
  amount!: number;
}

class AttemptsByStatusSchema {
  @ApiProperty({ description: "Pending attempts" })
  pending!: number;

  @ApiProperty({ description: "Succeeded attempts" })
  succeeded!: number;

  @ApiProperty({ description: "Failed attempts" })
  failed!: number;

  @ApiProperty({ description: "Skipped attempts" })
  skipped!: number;
}

class DunningOutcomesSchema {
  @ApiProperty({ description: "Successfully recovered" })
  recovered!: number;

  @ApiProperty({ description: "Subscription suspended" })
  suspended!: number;

  @ApiProperty({ description: "Subscription canceled" })
  canceled!: number;

  @ApiProperty({ description: "Still in dunning process" })
  stillInDunning!: number;
}

class DunningAnalyticsSchema {
  @ApiProperty({ description: "Total invoices currently in dunning" })
  invoicesInDunning!: number;

  @ApiProperty({ description: "Total amount at risk in cents" })
  totalAmountAtRisk!: number;

  @ApiProperty({
    description: "Amount at risk by currency",
    type: [AmountByCurrencySchema],
  })
  amountAtRiskByCurrency!: AmountByCurrencySchema[];

  @ApiProperty({ description: "Amount recovered this period in cents" })
  amountRecovered!: number;

  @ApiProperty({ description: "Recovery rate percentage (0-100)" })
  recoveryRate!: number;

  @ApiProperty({ description: "Average days to recover payment" })
  averageDaysToRecovery!: number;

  @ApiProperty({ description: "Attempts grouped by status" })
  attemptsByStatus!: AttemptsByStatusSchema;

  @ApiProperty({ description: "Dunning outcomes" })
  outcomes!: DunningOutcomesSchema;
}

class DunningTrendPointSchema {
  @ApiProperty({ description: "Date of the data point" })
  date!: Date;

  @ApiProperty({ description: "Invoices in dunning on this date" })
  invoicesInDunning!: number;

  @ApiProperty({ description: "Amount at risk in cents" })
  amountAtRisk!: number;

  @ApiProperty({ description: "Amount recovered in cents" })
  amountRecovered!: number;

  @ApiProperty({ description: "Recovery rate percentage" })
  recoveryRate!: number;

  @ApiProperty({ description: "New dunning cases started" })
  newDunningStarted!: number;
}

class RecoveryFunnelSchema {
  @ApiProperty({ description: "Total invoices that entered dunning" })
  totalStarted!: number;

  @ApiProperty({ description: "Recovered on first attempt" })
  recoveredAttempt1!: number;

  @ApiProperty({ description: "Recovered on second attempt" })
  recoveredAttempt2!: number;

  @ApiProperty({ description: "Recovered on third attempt" })
  recoveredAttempt3!: number;

  @ApiProperty({ description: "Recovered on fourth+ attempt" })
  recoveredAttempt4Plus!: number;

  @ApiProperty({ description: "Final action taken (suspend/cancel)" })
  finalActionTaken!: number;

  @ApiProperty({ description: "Still in progress" })
  stillInProgress!: number;
}

class DeclineCodeSchema {
  @ApiProperty({ description: "Decline code", example: "insufficient_funds" })
  code!: string;

  @ApiProperty({ description: "Number of occurrences" })
  count!: number;

  @ApiProperty({ description: "Percentage of total declines" })
  percentage!: number;
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
    private readonly dunningAnalyticsService: DunningAnalyticsService,
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

  // ============================================================================
  // DUNNING ANALYTICS ENDPOINTS
  // ============================================================================

  @Get("dunning")
  @ApiOperation({
    summary: "Get dunning analytics",
    description: `Returns comprehensive dunning analytics for the workspace.

**Metrics included:**
- Invoices currently in dunning
- Amount at risk (by currency)
- Amount recovered
- Recovery rate percentage
- Average days to recovery
- Attempts by status
- Dunning outcomes (recovered, suspended, canceled)

**Use cases:**
- Payment recovery performance monitoring
- Dunning process optimization
- Revenue risk assessment`,
  })
  @ApiResponse({
    status: 200,
    description: "Dunning analytics",
    type: DunningAnalyticsSchema,
  })
  async getDunningAnalytics(
    @WorkspaceId() workspaceId: string,
    @Query() query: GetDunningAnalyticsDto,
  ) {
    return this.dunningAnalyticsService.getDunningAnalytics(
      workspaceId,
      query.startDate ? new Date(query.startDate) : undefined,
      query.endDate ? new Date(query.endDate) : undefined,
    );
  }

  @Get("dunning/trend")
  @ApiOperation({
    summary: "Get dunning trend over time",
    description: `Returns historical dunning metrics over a date range.

**Use cases:**
- Track dunning volume trends
- Monitor recovery rate changes
- Identify seasonal patterns

**Periods:**
- \`daily\`: One data point per day
- \`weekly\`: One data point per week
- \`monthly\`: One data point per month`,
  })
  @ApiResponse({
    status: 200,
    description: "Dunning trend data points",
    type: [DunningTrendPointSchema],
  })
  async getDunningTrend(
    @WorkspaceId() workspaceId: string,
    @Query() query: GetDunningTrendDto,
  ) {
    return this.dunningAnalyticsService.getDunningTrend(
      workspaceId,
      new Date(query.startDate),
      new Date(query.endDate),
      query.period || "daily",
    );
  }

  @Get("dunning/funnel")
  @ApiOperation({
    summary: "Get recovery funnel",
    description: `Returns recovery funnel showing how many invoices were recovered at each attempt.

**Funnel stages:**
- Recovered at attempt 1, 2, 3, or 4+
- Final action taken (suspended/canceled)
- Still in progress

**Use cases:**
- Optimize retry schedule
- Understand recovery patterns
- Identify when most recoveries happen`,
  })
  @ApiResponse({
    status: 200,
    description: "Recovery funnel data",
    type: RecoveryFunnelSchema,
  })
  async getRecoveryFunnel(
    @WorkspaceId() workspaceId: string,
    @Query() query: GetDunningAnalyticsDto,
  ) {
    return this.dunningAnalyticsService.getRecoveryFunnel(
      workspaceId,
      query.startDate ? new Date(query.startDate) : undefined,
      query.endDate ? new Date(query.endDate) : undefined,
    );
  }

  @Get("dunning/decline-codes")
  @ApiOperation({
    summary: "Get decline code breakdown",
    description: `Returns a breakdown of payment decline codes from failed dunning attempts.

**Use cases:**
- Understand why payments fail
- Identify card network issues
- Guide customer communication

**Common codes:**
- \`insufficient_funds\`: Card has no funds
- \`card_declined\`: Generic decline
- \`expired_card\`: Card has expired
- \`fraudulent\`: Suspected fraud`,
  })
  @ApiResponse({
    status: 200,
    description: "Decline code breakdown",
    type: [DeclineCodeSchema],
  })
  async getDeclineCodeBreakdown(
    @WorkspaceId() workspaceId: string,
    @Query() query: GetDunningAnalyticsDto,
  ) {
    return this.dunningAnalyticsService.getDeclineCodeBreakdown(
      workspaceId,
      query.startDate ? new Date(query.startDate) : undefined,
      query.endDate ? new Date(query.endDate) : undefined,
    );
  }
}
