# =============================================================================
# RDS Module - Outputs
# =============================================================================

output "cluster_id" {
  description = "ID of the RDS cluster"
  value       = aws_rds_cluster.main.id
}

output "cluster_arn" {
  description = "ARN of the RDS cluster"
  value       = aws_rds_cluster.main.arn
}

output "endpoint" {
  description = "Writer endpoint of the cluster"
  value       = aws_rds_cluster.main.endpoint
}

output "reader_endpoint" {
  description = "Reader endpoint of the cluster"
  value       = aws_rds_cluster.main.reader_endpoint
}

output "port" {
  description = "Database port"
  value       = aws_rds_cluster.main.port
}

output "database_name" {
  description = "Name of the default database"
  value       = aws_rds_cluster.main.database_name
}

output "security_group_id" {
  description = "Security group ID of the RDS cluster"
  value       = aws_security_group.rds.id
}
