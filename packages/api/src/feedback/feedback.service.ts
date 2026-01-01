import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    type: "bug" | "feature" | "other";
    title: string;
    description: string;
    userId?: string;
    userEmail?: string;
  }) {
    const feedback = await this.prisma.feedback.create({
      data: {
        type: data.type,
        title: data.title,
        description: data.description,
        userId: data.userId,
        userEmail: data.userEmail,
        status: "pending",
      },
    });

    return {
      success: true,
      id: feedback.id,
      message: "Thank you for your feedback!",
    };
  }

  async list(params: {
    status?: "pending" | "reviewed" | "accepted" | "rejected" | "resolved";
    type?: "bug" | "feature" | "other";
    limit?: number;
    cursor?: string;
  }) {
    const limit = Math.min(params.limit || 50, 100);

    const where: any = {};
    if (params.status) where.status = params.status;
    if (params.type) where.type = params.type;

    const feedback = await this.prisma.feedback.findMany({
      where,
      take: limit + 1,
      cursor: params.cursor ? { id: params.cursor } : undefined,
      skip: params.cursor ? 1 : 0,
      orderBy: { createdAt: "desc" },
    });

    const hasMore = feedback.length > limit;
    if (hasMore) feedback.pop();

    return {
      data: feedback,
      hasMore,
      nextCursor: hasMore ? feedback[feedback.length - 1]?.id : undefined,
    };
  }

  async findById(id: string) {
    const feedback = await this.prisma.feedback.findUnique({
      where: { id },
    });

    if (!feedback) {
      throw new NotFoundException("Feedback not found");
    }

    return feedback;
  }

  async update(
    id: string,
    data: {
      status?: "pending" | "reviewed" | "accepted" | "rejected" | "resolved";
      response?: string;
    },
  ) {
    const feedback = await this.prisma.feedback.findUnique({
      where: { id },
    });

    if (!feedback) {
      throw new NotFoundException("Feedback not found");
    }

    const updateData: any = {};
    if (data.status) updateData.status = data.status;
    if (data.response) {
      updateData.response = data.response;
      updateData.respondedAt = new Date();
    }

    return this.prisma.feedback.update({
      where: { id },
      data: updateData,
    });
  }
}
