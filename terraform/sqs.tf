resource "aws_sqs_queue" "raw_telemetry" {
  name                      = "raw-telemetry-queue"
  delay_seconds             = 0
  max_message_size          = 262144
  message_retention_seconds = 86400
  receive_wait_time_seconds = 0

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.telemetry_dlq.arn
    maxReceiveCount     = 3 # after 3 failures, move to DLQ
  })

  tags = {
    Environment = "demo"
    Project     = "smart-fleet-hub"
  }
}
