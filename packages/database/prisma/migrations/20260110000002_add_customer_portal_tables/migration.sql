-- CreateTable
CREATE TABLE "customer_portal_session" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_portal_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_portal_magic_link" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_portal_magic_link_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_portal_session_token_key" ON "customer_portal_session"("token");

-- CreateIndex
CREATE INDEX "customer_portal_session_token_idx" ON "customer_portal_session"("token");

-- CreateIndex
CREATE INDEX "customer_portal_session_customer_id_idx" ON "customer_portal_session"("customer_id");

-- CreateIndex
CREATE INDEX "customer_portal_session_expires_at_idx" ON "customer_portal_session"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "customer_portal_magic_link_token_key" ON "customer_portal_magic_link"("token");

-- CreateIndex
CREATE INDEX "customer_portal_magic_link_token_idx" ON "customer_portal_magic_link"("token");

-- CreateIndex
CREATE INDEX "customer_portal_magic_link_customer_id_idx" ON "customer_portal_magic_link"("customer_id");

-- CreateIndex
CREATE INDEX "customer_portal_magic_link_expires_at_idx" ON "customer_portal_magic_link"("expires_at");
