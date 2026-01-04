# =============================================================================
# ElastiCache Module - Variables
# =============================================================================

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "vpc_id" {
  description = "ID of the VPC"
  type        = string
}

variable "cache_subnets" {
  description = "List of subnet IDs for the cache"
  type        = list(string)
}

variable "allowed_security_groups" {
  description = "Security groups allowed to connect to Redis"
  type        = list(string)
}

variable "node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t4g.micro"
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
