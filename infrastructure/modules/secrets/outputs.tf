# =============================================================================
# Secrets Module - Outputs
# =============================================================================

output "secrets_arn" {
  description = "ARN of the Secrets Manager secret"
  value       = aws_secretsmanager_secret.main.arn
}

output "secrets_name" {
  description = "Name of the Secrets Manager secret"
  value       = aws_secretsmanager_secret.main.name
}
