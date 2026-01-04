# =============================================================================
# Staging Environment - Variables
# =============================================================================

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "container_image_tag" {
  description = "Docker image tag to deploy"
  type        = string
  default     = "staging-latest"
}

# -----------------------------------------------------------------------------
# SSL Certificates
# -----------------------------------------------------------------------------
variable "acm_certificate_arn" {
  description = "ARN of ACM certificate for the API"
  type        = string
}

variable "admin_ui_certificate_arn" {
  description = "ARN of ACM certificate for admin UI (must be in us-east-1)"
  type        = string
}

variable "admin_ui_domain" {
  description = "Domain name for the admin UI"
  type        = string
}

# -----------------------------------------------------------------------------
# Secrets (should be passed via environment variables or secrets manager)
# -----------------------------------------------------------------------------
variable "database_password" {
  description = "Database password"
  type        = string
  sensitive   = true
}

variable "api_key_secret" {
  description = "Secret for API key generation"
  type        = string
  sensitive   = true
}

variable "webhook_secret" {
  description = "Secret for webhook signatures"
  type        = string
  sensitive   = true
}

variable "stripe_secret_key" {
  description = "Stripe secret API key"
  type        = string
  sensitive   = true
}

variable "stripe_webhook_secret" {
  description = "Stripe webhook signing secret"
  type        = string
  sensitive   = true
}
