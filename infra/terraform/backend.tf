terraform {
  backend "s3" {
    bucket       = "rentacar-v3-tfstate-455394300997"
    key          = "portfolio/terraform.tfstate"
    region       = "eu-central-1"
    encrypt      = true
    use_lockfile = true
  }
}