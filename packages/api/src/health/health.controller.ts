import { Controller, Get, HttpException, HttpStatus } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { Public } from "../common/decorators";
import { PrismaService } from "../database/prisma.service";

interface HealthResponse {
  status: "healthy" | "unhealthy";
  timestamp: string;
  version: string;
  uptime: number;
  services: {
    database: "up" | "down";
  };
  memory?: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    percentUsed: number;
  };
}

@ApiTags("health")
@Controller("health")
export class HealthController {
  private readonly startTime = Date.now();

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: "Health check",
    description:
      "Full health check including database connectivity and memory usage.",
  })
  @ApiResponse({ status: 200, description: "Service is healthy" })
  @ApiResponse({ status: 503, description: "Service is unhealthy" })
  async check(): Promise<HealthResponse> {
    const dbHealthy = await this.prisma.healthCheck();
    const memory = this.getMemoryUsage();

    const response: HealthResponse = {
      status: dbHealthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? "0.1.0",
      uptime: this.getUptime(),
      services: {
        database: dbHealthy ? "up" : "down",
      },
      memory,
    };

    if (!dbHealthy) {
      throw new HttpException(response, HttpStatus.SERVICE_UNAVAILABLE);
    }

    return response;
  }

  @Get("live")
  @Public()
  @ApiOperation({
    summary: "Liveness probe",
    description:
      "Simple check that the process is running. Use for Kubernetes/ECS liveness probes.",
  })
  @ApiResponse({ status: 200, description: "Service is alive" })
  live(): { status: string; uptime: number } {
    return {
      status: "ok",
      uptime: this.getUptime(),
    };
  }

  @Get("ready")
  @Public()
  @ApiOperation({
    summary: "Readiness probe",
    description:
      "Check if the service can handle requests. Verifies database connectivity. Use for load balancer health checks.",
  })
  @ApiResponse({ status: 200, description: "Service is ready" })
  @ApiResponse({ status: 503, description: "Service is not ready" })
  async ready(): Promise<{ status: string; database: string }> {
    const dbHealthy = await this.prisma.healthCheck();

    if (!dbHealthy) {
      throw new HttpException(
        {
          status: "not_ready",
          database: "down",
          message: "Database connection failed",
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return {
      status: "ready",
      database: "up",
    };
  }

  private getUptime(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  private getMemoryUsage() {
    const mem = process.memoryUsage();
    return {
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024), // MB
      rss: Math.round(mem.rss / 1024 / 1024), // MB
      percentUsed: Math.round((mem.heapUsed / mem.heapTotal) * 100),
    };
  }
}
