data "aws_caller_identity" "current" {}

terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  # We'll use local state for simplicity, but mention S3 backend for production.
}

provider "aws" {
  region = "us-east-1" # change to your preferred region
}
