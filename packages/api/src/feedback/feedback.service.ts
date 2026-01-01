import { Injectable, NotFoundException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../database/prisma.service";

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);
  private readonly githubToken: string | undefined;
  private readonly githubRepo: string | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.githubToken = this.configService.get<string>("GH_PAT");
    this.githubRepo = this.configService.get<string>(
      "GH_FEEDBACK_REPO",
      "PrimeCodeLabs/relay",
    );
  }

  async create(data: {
    type: "bug" | "feature" | "contact" | "other";
    title: string;
    description: string;
    userId?: string;
    userEmail?: string;
  }) {
    // Store in database for tracking
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

    // Create GitHub issue if configured
    let githubIssueUrl: string | undefined;
    if (this.githubToken && this.githubRepo) {
      try {
        githubIssueUrl = await this.createGitHubIssue(data, feedback.id);

        // Update feedback record with GitHub issue URL
        await this.prisma.feedback.update({
          where: { id: feedback.id },
          data: { response: `GitHub Issue: ${githubIssueUrl}` },
        });
      } catch (error) {
        this.logger.error("Failed to create GitHub issue", error);
        // Don't fail the request if GitHub issue creation fails
      }
    }

    return {
      success: true,
      id: feedback.id,
      message: "Thank you for your feedback!",
      githubIssue: githubIssueUrl,
    };
  }

  private async createGitHubIssue(
    data: {
      type: "bug" | "feature" | "contact" | "other";
      title: string;
      description: string;
      userEmail?: string;
    },
    feedbackId: string,
  ): Promise<string> {
    const labels = this.getLabelsForType(data.type);

    const body = this.formatIssueBody(data, feedbackId);

    const response = await fetch(
      `https://api.github.com/repos/${this.githubRepo}/issues`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.githubToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: `[${data.type.toUpperCase()}] ${data.title}`,
          body,
          labels,
        }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GitHub API error: ${response.status} - ${error}`);
    }

    const issue = (await response.json()) as {
      number: number;
      html_url: string;
    };
    this.logger.log(`Created GitHub issue #${issue.number}: ${issue.html_url}`);

    return issue.html_url;
  }

  private getLabelsForType(
    type: "bug" | "feature" | "contact" | "other",
  ): string[] {
    const labels = ["feedback"];

    switch (type) {
      case "bug":
        labels.push("bug");
        break;
      case "feature":
        labels.push("enhancement");
        break;
      case "contact":
        labels.push("contact");
        break;
      case "other":
        labels.push("question");
        break;
    }

    return labels;
  }

  private formatIssueBody(
    data: {
      type: "bug" | "feature" | "contact" | "other";
      title: string;
      description: string;
      userEmail?: string;
    },
    feedbackId: string,
  ): string {
    const sections = [
      "## Feedback Details",
      "",
      data.description,
      "",
      "---",
      "",
      "### Metadata",
      "",
      `- **Type:** ${data.type}`,
      `- **Feedback ID:** \`${feedbackId}\``,
    ];

    if (data.userEmail) {
      sections.push(`- **Contact:** ${data.userEmail}`);
    }

    sections.push(
      "",
      "---",
      "*This issue was automatically created from user feedback.*",
    );

    return sections.join("\n");
  }

  async list(params: {
    status?: "pending" | "reviewed" | "accepted" | "rejected" | "resolved";
    type?: "bug" | "feature" | "contact" | "other";
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
