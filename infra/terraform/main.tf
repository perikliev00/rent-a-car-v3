resource "aws_lightsail_instance" "rentacar" {
  name              = var.instance_name
  availability_zone = var.availability_zone
  blueprint_id      = var.blueprint_id
  bundle_id         = var.bundle_id

  tags = {
    Name = var.instance_name
    Role = "application-server"
  }
}

resource "aws_lightsail_static_ip" "rentacar" {
  name = "${var.instance_name}-ip"
}

resource "aws_lightsail_static_ip_attachment" "rentacar" {
  static_ip_name = aws_lightsail_static_ip.rentacar.name
  instance_name  = aws_lightsail_instance.rentacar.name
}

resource "aws_lightsail_instance_public_ports" "rentacar" {
  instance_name = aws_lightsail_instance.rentacar.name

  # SSH only through AWS Lightsail browser SSH for now.
  port_info {
    protocol  = "tcp"
    from_port = 22
    to_port   = 22

    cidr_list_aliases = [
      "lightsail-connect"
    ]
  }

  # HTTP
  port_info {
    protocol  = "tcp"
    from_port = 80
    to_port   = 80

    cidrs = [
      "0.0.0.0/0"
    ]
  }

  # HTTPS
  port_info {
    protocol  = "tcp"
    from_port = 443
    to_port   = 443

    cidrs = [
      "0.0.0.0/0"
    ]
  }
}

locals {
  ecr_repositories = toset([
    "rentacar-api",
    "rentacar-customer",
    "rentacar-admin"
  ])
}

resource "aws_ecr_repository" "app" {
  for_each = local.ecr_repositories

  name                 = each.value
  image_tag_mutability = "IMMUTABLE"

  encryption_configuration {
    encryption_type = "AES256"
  }

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "app" {
  for_each = aws_ecr_repository.app

  repository = each.value.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Delete untagged images after 1 day"

        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 1
        }

        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 99
        description  = "Keep only the latest 15 images"

        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 15
        }

        action = {
          type = "expire"
        }
      }
    ]
  })
}

data "aws_caller_identity" "current" {}

resource "aws_lightsail_bucket" "storage" {
  name      = "rentacar-v3-prod-storage-${data.aws_caller_identity.current.account_id}"
  bundle_id = "small_1_0"

  force_delete = false

  tags = {
    Role = "application-storage"
  }
}

resource "aws_lightsail_bucket_resource_access" "storage" {
  bucket_name   = aws_lightsail_bucket.storage.id
  resource_name = aws_lightsail_instance.rentacar.id
}