resource "aws_sqs_queue" "telemetry_dlq" {
  name                      = "raw-telemetry-dlq"
  message_retention_seconds = 1209600 # 14 days to investigate
  tags = {
    Environment = "demo"
    Project     = "smart-fleet-hub"
  }
}
