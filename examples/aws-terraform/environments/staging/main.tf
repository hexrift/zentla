# =============================================================================
# Zentla Infrastructure - Staging Environment
# =============================================================================
# This is the staging environment configuration.
# Run: terraform init && terraform apply
# =============================================================================

terraform {
  required_version = ">= 1.5.0"

  # Uncomment and configure for remote state storage
  # backend "s3" {
  #   bucket         = "zentla-terraform-state"
  #   key            = "staging/terraform.tfstate"
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
      Environment = "staging"
      ManagedBy   = "terraform"
    }
  }
}

# Use the root module
module "zentla" {
  source = "../../"

  project     = "zentla"
  environment = "staging"
  aws_region  = var.aws_region

  # Networking
  vpc_cidr           = "10.0.0.0/16"
  availability_zones = ["us-east-1a", "us-east-1b"]

  # Database - smaller for staging
  database_name     = "zentla"
  database_username = "zentla_admin"
  database_password = var.database_password
  rds_min_capacity  = 0.5
  rds_max_capacity  = 2

  # Redis - smaller for staging
  redis_node_type = "cache.t4g.micro"

  # ECS - smaller for staging
  container_image_tag = var.container_image_tag
  ecs_desired_count   = 1
  ecs_cpu             = 256
  ecs_memory          = 512

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
  value = module.zentla.rds_endpoint
}

output "redis_endpoint" {
  value = module.zentla.redis_endpoint
}

output "admin_ui_cloudfront_domain" {
  value = module.zentla.admin_ui_cloudfront_domain
}

output "admin_ui_bucket_name" {
  value = module.zentla.admin_ui_bucket_name
}

output "ecs_cluster_name" {
  value = module.zentla.ecs_cluster_name
}

output "ecs_service_name" {
  value = module.zentla.ecs_service_name
}
