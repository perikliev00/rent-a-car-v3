variable "instance_name" {
  description = "Lightsail instance name"
  type        = string
  default     = "rentacar-v3-prod"
}

variable "availability_zone" {
  description = "Lightsail availability zone"
  type        = string
  default     = "eu-central-1a"
}

variable "blueprint_id" {
  description = "Lightsail OS blueprint"
  type        = string
  default     = "ubuntu_24_04"
}

variable "bundle_id" {
  description = "Lightsail instance bundle"
  type        = string
  default     = "small_3_0"
}