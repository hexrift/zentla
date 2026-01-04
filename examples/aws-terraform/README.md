# Zentla Infrastructure

Terraform configuration for deploying Zentla to AWS.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AWS Cloud                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                            VPC (10.0.0.0/16)                           │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │ │
│  │  │              Public Subnets (NAT, ALB)                           │  │ │
│  │  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │  │ │
│  │  │  │ NAT Gateway │    │     ALB     │    │  (unused)   │          │  │ │
│  │  │  │   AZ-1a     │    │   AZ-1a/1b  │    │    AZ-1c    │          │  │ │
│  │  │  └─────────────┘    └─────────────┘    └─────────────┘          │  │ │
│  │  └──────────────────────────────────────────────────────────────────┘  │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │ │
│  │  │              Private Subnets (ECS, ElastiCache)                  │  │ │
│  │  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │  │ │
│  │  │  │ ECS Fargate │    │ ECS Fargate │    │    Redis    │          │  │ │
│  │  │  │   AZ-1a     │    │   AZ-1b     │    │   AZ-1a/1b  │          │  │ │
│  │  │  └─────────────┘    └─────────────┘    └─────────────┘          │  │ │
│  │  └──────────────────────────────────────────────────────────────────┘  │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │ │
│  │  │              Database Subnets (Isolated)                         │  │ │
│  │  │  ┌─────────────────────────────────────────────────────────┐    │  │ │
│  │  │  │              Aurora Serverless v2 PostgreSQL            │    │  │ │
│  │  │  │                    (Multi-AZ)                            │    │  │ │
│  │  │  └─────────────────────────────────────────────────────────┘    │  │ │
│  │  └──────────────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────┐    ┌────────────────────┐                          │
│  │        ECR         │    │   Secrets Manager  │                          │
│  │  (Container Repo)  │    │  (API Keys, etc.)  │                          │
│  └────────────────────┘    └────────────────────┘                          │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                        CloudFront + S3                                  │ │
│  │                     (Admin UI Static Site)                              │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
infrastructure/
├── main.tf                 # Root module - orchestrates all components
├── variables.tf            # Input variables
├── outputs.tf              # Output values
├── backend/                # Remote state backend setup (run first)
│   └── main.tf
├── environments/
│   ├── staging/            # Staging environment config
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── terraform.tfvars.example
│   └── production/         # Production environment config
│       ├── main.tf
│       ├── variables.tf
│       └── terraform.tfvars.example
└── modules/
    ├── vpc/                # VPC, subnets, NAT gateway
    ├── ecr/                # Container registry
    ├── ecs/                # Fargate cluster and service
    ├── rds/                # Aurora Serverless v2
    ├── elasticache/        # Redis cluster
    ├── alb/                # Application Load Balancer
    ├── secrets/            # Secrets Manager
    └── s3-cloudfront/      # Static website hosting
```

## Prerequisites

1. AWS CLI configured with appropriate credentials
2. Terraform >= 1.5.0
3. ACM certificates created for your domains

## Quick Start

### 1. Set up the backend (one-time)

```bash
cd infrastructure/backend
terraform init
terraform apply
```

### 2. Deploy staging environment

```bash
cd infrastructure/environments/staging

# Copy and edit the example variables
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values

# Set sensitive variables via environment
export TF_VAR_database_password="your-secure-password"
export TF_VAR_api_key_secret="your-api-key-secret"
export TF_VAR_webhook_secret="your-webhook-secret"
export TF_VAR_stripe_secret_key="sk_test_..."
export TF_VAR_stripe_webhook_secret="whsec_..."

# Deploy
terraform init
terraform plan
terraform apply
```

### 3. Deploy production environment

```bash
cd infrastructure/environments/production
# Same steps as staging with production values
```

## Cost Estimates

### Staging (~$100-150/month)

- ECS Fargate: 1 task (0.25 vCPU, 512MB) ~$10
- Aurora Serverless v2: 0.5-2 ACU ~$40-60
- ElastiCache: cache.t4g.micro (2 nodes) ~$25
- NAT Gateway: ~$35
- ALB: ~$20
- Other (S3, CloudFront, etc.): ~$10

### Production (~$300-500/month)

- ECS Fargate: 2 tasks (0.5 vCPU, 1GB) ~$30
- Aurora Serverless v2: 1-8 ACU ~$100-200
- ElastiCache: cache.t4g.small (2 nodes) ~$50
- NAT Gateway: ~$35
- ALB: ~$20
- Other: ~$20

## Modules

### VPC

- Public, private, and database subnets across 2-3 AZs
- NAT Gateway for private subnet internet access
- VPC Flow Logs enabled

### ECS

- Fargate cluster with container insights
- Auto-scaling based on CPU/memory
- Health checks and deployment circuit breaker

### RDS (Aurora Serverless v2)

- PostgreSQL 15
- Automatic scaling
- Encryption at rest
- Automated backups

### ElastiCache (Redis)

- Redis 7.0 cluster mode disabled
- Multi-AZ with automatic failover
- Encryption at rest

### ALB

- HTTPS only (HTTP redirects to HTTPS)
- Access logs to S3
- Health checks

### S3 + CloudFront

- S3 bucket with versioning
- CloudFront with OAC (Origin Access Control)
- SPA routing support (404 → index.html)

## Security

- All secrets stored in AWS Secrets Manager
- Database in isolated subnets (no internet access)
- ECS tasks in private subnets
- All traffic encrypted in transit
- VPC Flow Logs for network monitoring
- ALB access logs for request auditing

## Customization

Each module accepts a `tags` variable for consistent resource tagging. Modify the environment configs to adjust:

- Instance sizes (ECS CPU/memory, RDS ACU, Redis node type)
- Scaling parameters
- Backup retention
- Network configuration
