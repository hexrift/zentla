import { PrismaClient, Prisma } from "@prisma/client";

export interface PrismaClientOptions {
  datasourceUrl?: string;
  log?: Prisma.LogLevel[];
}

export function createPrismaClient(
  options: PrismaClientOptions = {},
): PrismaClient {
  const { datasourceUrl, log = ["error", "warn"] } = options;

  return new PrismaClient({
    datasourceUrl,
    log: log.map((level) => ({
      emit: "stdout" as const,
      level,
    })),
  });
}

// Singleton instance for application use
let prismaInstance: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = createPrismaClient();
  }
  return prismaInstance;
}

export async function disconnectPrisma(): Promise<void> {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
  }
}
