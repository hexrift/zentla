# =============================================================================
# Zentla Infrastructure - Production Environment
# =============================================================================
# This is the production environment configuration.
# Run: terraform init && terraform apply
# =============================================================================

terraform {
  required_version = ">= 1.5.0"

  # Uncomment and configure for remote state storage
  # backend "s3" {
  #   bucket         = "zentla-terraform-state"
  #   key            = "production/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "zentla-terraform-locks"
  #   encrypt        = true
  # }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "zentla"
      Environment = "production"
      ManagedBy   = "terraform"
    }
  }
}

# Use the root module
module "zentla" {
  source = "../../"

  project     = "zentla"
  environment = "production"
  aws_region  = var.aws_region

  # Networking - 3 AZs for production
  vpc_cidr           = "10.1.0.0/16"
  availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]

  # Database - larger for production
  database_name     = "zentla"
  database_username = "zentla_admin"
  database_password = var.database_password
  rds_min_capacity  = 1
  rds_max_capacity  = 8

  # Redis - larger for production
  redis_node_type = "cache.t4g.small"

  # ECS - production sizing
  container_image_tag = var.container_image_tag
  ecs_desired_count   = 2
  ecs_cpu             = 512
  ecs_memory          = 1024

  # SSL Certificates
  acm_certificate_arn      = var.acm_certificate_arn
  admin_ui_certificate_arn = var.admin_ui_certificate_arn
  admin_ui_domain          = var.admin_ui_domain

  # Secrets
  api_key_secret        = var.api_key_secret
  webhook_secret        = var.webhook_secret
  stripe_secret_key     = var.stripe_secret_key
  stripe_webhook_secret = var.stripe_webhook_secret
}

# -----------------------------------------------------------------------------
# Outputs
# -----------------------------------------------------------------------------
output "vpc_id" {
  value = module.zentla.vpc_id
}

output "alb_dns_name" {
  value = module.zentla.alb_dns_name
}

output "ecr_repository_url" {
  value = module.zentla.ecr_repository_url
}

output "rds_endpoint" {
  value     = module.zentla.rds_endpoint
  sensitive = true
}

output "redis_endpoint" {
  value     = module.zentla.redis_endpoint
  sensitive = true
}

output "admin_ui_cloudfront_domain" {
  value = module.zentla.admin_ui_cloudfront_domain
}

output "admin_ui_bucket_name" {
  value = module.zentla.admin_ui_bucket_name
}

output "admin_ui_distribution_id" {
  value = module.zentla.admin_ui_cloudfront_distribution_id
}

output "ecs_cluster_name" {
  value = module.zentla.ecs_cluster_name
}

output "ecs_service_name" {
  value = module.zentla.ecs_service_name
}
