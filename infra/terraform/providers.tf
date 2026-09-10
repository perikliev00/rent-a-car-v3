provider "aws" {
  region = "eu-central-1"

  default_tags {
    tags = {
      Project     = "rent-a-car-v3"
      Environment = "portfolio"
      ManagedBy   = "Terraform"
    }
  }
}