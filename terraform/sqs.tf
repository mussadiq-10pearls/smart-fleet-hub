resource "aws_sqs_queue" "raw_telemetry" {
  name                      = "raw-telemetry-queue"
  delay_seconds             = 0
  max_message_size          = 262144 # 256 KB
  message_retention_seconds = 86400  # 1 day
  receive_wait_time_seconds = 0      # short polling

  # Policy to allow Lambda (EventBridge) to send messages
  # We'll add this when we set up the scheduler.
}
