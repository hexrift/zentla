# =============================================================================
# Zentla Infrastructure - Variables
# =============================================================================

# -----------------------------------------------------------------------------
# General
# -----------------------------------------------------------------------------
variable "project" {
  description = "Project name used for resource naming"
  type        = string
  default     = "zentla"
}

variable "environment" {
  description = "Environment (staging, production)"
  type        = string

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be 'staging' or 'production'."
  }
}

variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

# -----------------------------------------------------------------------------
# Networking
# -----------------------------------------------------------------------------
variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of availability zones"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

# -----------------------------------------------------------------------------
# Database
# -----------------------------------------------------------------------------
variable "database_name" {
  description = "Name of the PostgreSQL database"
  type        = string
  default     = "zentla"
}

variable "database_username" {
  description = "Master username for the database"
  type        = string
  default     = "relay_admin"
}

variable "database_password" {
  description = "Master password for the database"
  type        = string
  sensitive   = true
}

variable "rds_min_capacity" {
  description = "Minimum Aurora Serverless v2 capacity (ACUs)"
  type        = number
  default     = 0.5
}

variable "rds_max_capacity" {
  description = "Maximum Aurora Serverless v2 capacity (ACUs)"
  type        = number
  default     = 4
}

# -----------------------------------------------------------------------------
# Redis
# -----------------------------------------------------------------------------
variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t4g.micro"
}

# -----------------------------------------------------------------------------
# ECS
# -----------------------------------------------------------------------------
variable "container_image_tag" {
  description = "Docker image tag to deploy"
  type        = string
  default     = "latest"
}

variable "ecs_desired_count" {
  description = "Desired number of ECS tasks"
  type        = number
  default     = 2
}

variable "ecs_cpu" {
  description = "CPU units for ECS task (1024 = 1 vCPU)"
  type        = number
  default     = 512
}

variable "ecs_memory" {
  description = "Memory for ECS task in MB"
  type        = number
  default     = 1024
}

# -----------------------------------------------------------------------------
# SSL/TLS
# -----------------------------------------------------------------------------
variable "acm_certificate_arn" {
  description = "ARN of ACM certificate for the API load balancer"
  type        = string
}

variable "admin_ui_certificate_arn" {
  description = "ARN of ACM certificate for admin UI CloudFront (must be in us-east-1)"
  type        = string
}

variable "admin_ui_domain" {
  description = "Domain name for the admin UI"
  type        = string
}

# -----------------------------------------------------------------------------
# Secrets
# -----------------------------------------------------------------------------
variable "api_key_secret" {
  description = "Secret used for API key generation/validation"
  type        = string
  sensitive   = true
}

variable "webhook_secret" {
  description = "Secret used for webhook signature verification"
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
