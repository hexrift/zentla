# =============================================================================
# Relay Infrastructure - Outputs
# =============================================================================

# -----------------------------------------------------------------------------
# Networking
# -----------------------------------------------------------------------------
output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

output "public_subnet_ids" {
  description = "IDs of public subnets"
  value       = module.vpc.public_subnet_ids
}

output "private_subnet_ids" {
  description = "IDs of private subnets"
  value       = module.vpc.private_subnet_ids
}

# -----------------------------------------------------------------------------
# ECR
# -----------------------------------------------------------------------------
output "ecr_repository_url" {
  description = "URL of the ECR repository"
  value       = module.ecr.repository_url
}

# -----------------------------------------------------------------------------
# Database
# -----------------------------------------------------------------------------
output "rds_endpoint" {
  description = "RDS cluster endpoint"
  value       = module.rds.endpoint
}

output "rds_reader_endpoint" {
  description = "RDS cluster reader endpoint"
  value       = module.rds.reader_endpoint
}

# -----------------------------------------------------------------------------
# Redis
# -----------------------------------------------------------------------------
output "redis_endpoint" {
  description = "ElastiCache Redis endpoint"
  value       = module.elasticache.endpoint
}

# -----------------------------------------------------------------------------
# Load Balancer
# -----------------------------------------------------------------------------
output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = module.alb.dns_name
}

output "alb_zone_id" {
  description = "Zone ID of the Application Load Balancer"
  value       = module.alb.zone_id
}

# -----------------------------------------------------------------------------
# ECS
# -----------------------------------------------------------------------------
output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = module.ecs.cluster_name
}

output "ecs_service_name" {
  description = "Name of the ECS service"
  value       = module.ecs.service_name
}

# -----------------------------------------------------------------------------
# Admin UI
# -----------------------------------------------------------------------------
output "admin_ui_bucket_name" {
  description = "S3 bucket name for admin UI"
  value       = module.admin_ui.bucket_name
}

output "admin_ui_cloudfront_domain" {
  description = "CloudFront distribution domain for admin UI"
  value       = module.admin_ui.cloudfront_domain
}

output "admin_ui_cloudfront_distribution_id" {
  description = "CloudFront distribution ID for admin UI"
  value       = module.admin_ui.distribution_id
}

# -----------------------------------------------------------------------------
# Secrets
# -----------------------------------------------------------------------------
output "secrets_arn" {
  description = "ARN of the Secrets Manager secret"
  value       = module.secrets.secrets_arn
}
