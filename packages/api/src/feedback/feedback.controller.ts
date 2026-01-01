import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
} from "@nestjs/swagger";
import { FeedbackService } from "./feedback.service";
import {
  IsString,
  IsEnum,
  IsOptional,
  IsEmail,
  MinLength,
  MaxLength,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { SessionUser, OptionalAuth } from "../common/decorators";

class CreateFeedbackDto {
  @ApiProperty({ enum: ["bug", "feature", "other"] })
  @IsEnum(["bug", "feature", "other"])
  type!: "bug" | "feature" | "other";

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description!: string;

  @ApiPropertyOptional({
    description: "Email for follow-up (optional for anonymous users)",
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;
}

class UpdateFeedbackDto {
  @ApiPropertyOptional({
    enum: ["pending", "reviewed", "accepted", "rejected", "resolved"],
  })
  @IsOptional()
  @IsEnum(["pending", "reviewed", "accepted", "rejected", "resolved"])
  status?: "pending" | "reviewed" | "accepted" | "rejected" | "resolved";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  response?: string;
}

@ApiTags("feedback")
@Controller("feedback")
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  @OptionalAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Submit feedback",
    description: "Submit bug reports, feature requests, or general feedback.",
  })
  @ApiResponse({ status: 201, description: "Feedback submitted successfully" })
  async create(
    @Body() dto: CreateFeedbackDto,
    @SessionUser() user: { id: string; email: string } | null,
  ) {
    return this.feedbackService.create({
      type: dto.type,
      title: dto.title,
      description: dto.description,
      userId: user?.id,
      userEmail: user?.email ?? dto.email,
    });
  }

  @Get()
  @ApiSecurity("api-key")
  @ApiOperation({
    summary: "List all feedback",
    description: "List all feedback submissions. Admin only.",
  })
  @ApiResponse({ status: 200, description: "Feedback list" })
  async list(
    @Query("status") status?: string,
    @Query("type") type?: string,
    @Query("limit") limit?: string,
    @Query("cursor") cursor?: string,
  ) {
    return this.feedbackService.list({
      status: status as any,
      type: type as any,
      limit: limit ? parseInt(limit, 10) : undefined,
      cursor,
    });
  }

  @Get(":id")
  @ApiSecurity("api-key")
  @ApiOperation({ summary: "Get feedback by ID" })
  @ApiResponse({ status: 200, description: "Feedback details" })
  async get(@Param("id") id: string) {
    return this.feedbackService.findById(id);
  }

  @Patch(":id")
  @ApiSecurity("api-key")
  @ApiOperation({
    summary: "Update feedback status",
    description: "Update feedback status and add response. Admin only.",
  })
  @ApiResponse({ status: 200, description: "Feedback updated" })
  async update(@Param("id") id: string, @Body() dto: UpdateFeedbackDto) {
    return this.feedbackService.update(id, dto);
  }
}
