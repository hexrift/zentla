# =============================================================================
# Relay Infrastructure - Main Configuration
# =============================================================================
# This is the root module that orchestrates all infrastructure components.
# Use environments/staging or environments/production for actual deployments.
# =============================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
}

# -----------------------------------------------------------------------------
# Local Variables
# -----------------------------------------------------------------------------
locals {
  name_prefix = "${var.project}-${var.environment}"

  common_tags = {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
    Repository  = "relay"
  }
}

# -----------------------------------------------------------------------------
# VPC & Networking
# -----------------------------------------------------------------------------
module "vpc" {
  source = "./modules/vpc"

  name_prefix        = local.name_prefix
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# ECR Repository
# -----------------------------------------------------------------------------
module "ecr" {
  source = "./modules/ecr"

  name_prefix = local.name_prefix

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# Secrets Manager
# -----------------------------------------------------------------------------
module "secrets" {
  source = "./modules/secrets"

  name_prefix         = local.name_prefix
  database_password   = var.database_password
  api_key_secret      = var.api_key_secret
  webhook_secret      = var.webhook_secret
  stripe_secret_key   = var.stripe_secret_key
  stripe_webhook_secret = var.stripe_webhook_secret

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# RDS Aurora Serverless v2
# -----------------------------------------------------------------------------
module "rds" {
  source = "./modules/rds"

  name_prefix        = local.name_prefix
  vpc_id             = module.vpc.vpc_id
  database_subnets   = module.vpc.database_subnet_ids
  allowed_security_groups = [module.ecs.ecs_security_group_id]

  database_name      = var.database_name
  master_username    = var.database_username
  master_password    = var.database_password

  min_capacity       = var.rds_min_capacity
  max_capacity       = var.rds_max_capacity

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# ElastiCache Redis
# -----------------------------------------------------------------------------
module "elasticache" {
  source = "./modules/elasticache"

  name_prefix        = local.name_prefix
  vpc_id             = module.vpc.vpc_id
  cache_subnets      = module.vpc.private_subnet_ids
  allowed_security_groups = [module.ecs.ecs_security_group_id]

  node_type          = var.redis_node_type

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# Application Load Balancer
# -----------------------------------------------------------------------------
module "alb" {
  source = "./modules/alb"

  name_prefix     = local.name_prefix
  vpc_id          = module.vpc.vpc_id
  public_subnets  = module.vpc.public_subnet_ids
  certificate_arn = var.acm_certificate_arn

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# ECS Cluster & Services
# -----------------------------------------------------------------------------
module "ecs" {
  source = "./modules/ecs"

  name_prefix     = local.name_prefix
  vpc_id          = module.vpc.vpc_id
  private_subnets = module.vpc.private_subnet_ids

  # ALB
  alb_security_group_id = module.alb.security_group_id
  target_group_arn      = module.alb.target_group_arn

  # Container configuration
  ecr_repository_url = module.ecr.repository_url
  container_image_tag = var.container_image_tag

  # Environment
  database_url       = "postgresql://${var.database_username}:${var.database_password}@${module.rds.endpoint}/${var.database_name}?schema=public"
  redis_url          = "redis://${module.elasticache.endpoint}:6379"
  secrets_arn        = module.secrets.secrets_arn

  # Scaling
  desired_count      = var.ecs_desired_count
  cpu                = var.ecs_cpu
  memory             = var.ecs_memory

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# S3 + CloudFront for Admin UI
# -----------------------------------------------------------------------------
module "admin_ui" {
  source = "./modules/s3-cloudfront"

  name_prefix     = local.name_prefix
  domain_name     = var.admin_ui_domain
  certificate_arn = var.admin_ui_certificate_arn

  tags = local.common_tags
}
