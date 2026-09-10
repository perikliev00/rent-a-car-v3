output "terraform_state_bucket" {
  description = "S3 bucket used for Terraform remote state"
  value       = aws_s3_bucket.terraform_state.bucket
}

output "aws_region" {
  description = "AWS region used by Terraform"
  value       = data.aws_region.current.region
}