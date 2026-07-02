data "aws_caller_identity" "current" {}

terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.40.0"
    }
  }
  backend "s3" {
    bucket         = "smart-fleet-terraform-state-469128506110" # replace with your bucket name
    key            = "smart-fleet-hub/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
  }
}

provider "aws" {
  region = "us-east-1" # change to your preferred region
}
