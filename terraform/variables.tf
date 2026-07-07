variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "groq_api_key" {
  description = "Groq API key for AI scoring"
  type        = string
  sensitive   = true # hides the value from console output
}
