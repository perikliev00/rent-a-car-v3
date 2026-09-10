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