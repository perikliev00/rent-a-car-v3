output "lightsail_instance_name" {
  description = "Lightsail instance name"
  value       = aws_lightsail_instance.rentacar.name
}

output "lightsail_static_ip" {
  description = "Public static IPv4 address"
  value       = aws_lightsail_static_ip.rentacar.ip_address
}

output "lightsail_username" {
  description = "Default SSH username"
  value       = aws_lightsail_instance.rentacar.username
}
output "ecr_repository_urls" {
  description = "ECR repository URLs"

  value = {
    for name, repository in aws_ecr_repository.app :
    name => repository.repository_url
  }
}
output "github_actions_role_arn" {
  description = "IAM role assumed by GitHub Actions through OIDC"
  value       = aws_iam_role.github_actions.arn
}
output "lightsail_storage_bucket_name" {
  description = "Lightsail object storage bucket name"
  value       = aws_lightsail_bucket.storage.name
}

output "lightsail_storage_bucket_url" {
  description = "Lightsail object storage bucket URL"
  value       = aws_lightsail_bucket.storage.url
}