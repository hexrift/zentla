import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

// Must match API_KEY_SECRET from .env - used for hashing API keys
const API_KEY_SECRET =
  process.env.API_KEY_SECRET || "your-32-character-secret-key-here";

function generateApiKey(environment: "live" | "test"): {
  fullKey: string;
  prefix: string;
  hash: string;
} {
  const prefix = `relay_${environment}_`;
  const randomPart = crypto.randomBytes(24).toString("base64url");
  const fullKey = `${prefix}${randomPart}`;
  // Hash must include the secret, matching api-key.service.ts
  const hash = crypto
    .createHash("sha256")
    .update(fullKey)
    .update(API_KEY_SECRET)
    .digest("hex");

  return {
    fullKey,
    prefix: fullKey.substring(0, prefix.length + 8),
    hash,
  };
}

async function main(): Promise<void> {
  console.log("Seeding database...");

  // Create demo workspace
  const workspace = await prisma.workspace.upsert({
    where: { slug: "demo" },
    update: {},
    create: {
      name: "Demo Workspace",
      slug: "demo",
      defaultProvider: "stripe",
      settings: {
        currency: "USD",
        timezone: "UTC",
      },
    },
  });

  console.log(`Created workspace: ${workspace.name} (${workspace.id})`);

  // Create test API key
  const testKey = generateApiKey("test");
  const testApiKey = await prisma.apiKey.upsert({
    where: { keyPrefix: testKey.prefix },
    update: {},
    create: {
      workspaceId: workspace.id,
      name: "Development Test Key",
      keyPrefix: testKey.prefix,
      keyHash: testKey.hash,
      role: "owner",
      environment: "test",
    },
  });

  console.log(`Created test API key: ${testApiKey.name}`);
  console.log(`  Full key (save this - shown only once): ${testKey.fullKey}`);

  // Create live API key
  const liveKey = generateApiKey("live");
  const liveApiKey = await prisma.apiKey.upsert({
    where: { keyPrefix: liveKey.prefix },
    update: {},
    create: {
      workspaceId: workspace.id,
      name: "Production Key",
      keyPrefix: liveKey.prefix,
      keyHash: liveKey.hash,
      role: "owner",
      environment: "live",
    },
  });

  console.log(`Created live API key: ${liveApiKey.name}`);
  console.log(`  Full key (save this - shown only once): ${liveKey.fullKey}`);

  // Create sample offer
  const offer = await prisma.offer.upsert({
    where: {
      id: "00000000-0000-0000-0000-000000000001",
    },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      workspaceId: workspace.id,
      name: "Pro Plan",
      description: "Everything you need to get started",
      status: "active",
    },
  });

  // Create offer version
  const offerVersion = await prisma.offerVersion.upsert({
    where: {
      offerId_version: {
        offerId: offer.id,
        version: 1,
      },
    },
    update: {},
    create: {
      offerId: offer.id,
      version: 1,
      status: "published",
      publishedAt: new Date(),
      config: {
        pricing: {
          model: "flat",
          currency: "USD",
          amount: 2900,
          interval: "month",
          intervalCount: 1,
        },
        trial: {
          days: 14,
          requirePaymentMethod: true,
        },
        entitlements: [
          { featureKey: "seats", value: 10, valueType: "number" },
          { featureKey: "api_access", value: true, valueType: "boolean" },
          { featureKey: "storage_gb", value: 100, valueType: "number" },
          { featureKey: "support", value: "email", valueType: "string" },
        ],
      },
    },
  });

  // Update offer with current version
  await prisma.offer.update({
    where: { id: offer.id },
    data: { currentVersionId: offerVersion.id },
  });

  console.log(`Created offer: ${offer.name} (version ${offerVersion.version})`);

  // Create sample customer
  const customer = await prisma.customer.upsert({
    where: {
      workspaceId_email: {
        workspaceId: workspace.id,
        email: "demo@example.com",
      },
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      email: "demo@example.com",
      name: "Demo Customer",
      externalId: "demo-customer-001",
      metadata: {
        source: "seed",
        company: "Acme Inc",
      },
    },
  });

  console.log(`Created customer: ${customer.email}`);

  // Create sample webhook endpoint
  const webhookEndpoint = await prisma.webhookEndpoint.upsert({
    where: {
      id: "00000000-0000-0000-0000-000000000002",
    },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000002",
      workspaceId: workspace.id,
      url: "https://webhook.site/your-unique-url",
      secret: crypto.randomBytes(32).toString("hex"),
      events: [
        "subscription.created",
        "subscription.updated",
        "subscription.canceled",
        "checkout.completed",
        "customer.created",
      ],
      status: "disabled",
      description: "Sample webhook endpoint (disabled by default)",
    },
  });

  console.log(`Created webhook endpoint: ${webhookEndpoint.url}`);

  console.log("\n--- Seed completed ---");
  console.log("\nTo get started:");
  console.log("1. Start the API: yarn dev");
  console.log("2. Use the test API key to authenticate");
  console.log(`3. API docs available at: http://localhost:3000/docs`);
}

main()
  .catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
