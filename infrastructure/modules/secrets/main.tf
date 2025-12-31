# =============================================================================
# Secrets Module
# =============================================================================
# Creates AWS Secrets Manager secret for application secrets
# =============================================================================

resource "aws_secretsmanager_secret" "main" {
  name        = "${var.name_prefix}/app-secrets"
  description = "Application secrets for ${var.name_prefix}"

  recovery_window_in_days = 7

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-app-secrets"
  })
}

resource "aws_secretsmanager_secret_version" "main" {
  secret_id = aws_secretsmanager_secret.main.id

  secret_string = jsonencode({
    DATABASE_PASSWORD     = var.database_password
    API_KEY_SECRET        = var.api_key_secret
    WEBHOOK_SECRET        = var.webhook_secret
    STRIPE_SECRET_KEY     = var.stripe_secret_key
    STRIPE_WEBHOOK_SECRET = var.stripe_webhook_secret
  })
}
