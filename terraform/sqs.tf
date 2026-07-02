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

resource "aws_sqs_queue" "alerts_queue" {
  name                      = "safety-alerts-queue"
  message_retention_seconds = 86400 # 1 day
}

resource "aws_sqs_queue_policy" "alerts_queue_policy" {
  queue_url = aws_sqs_queue.alerts_queue.id
  policy    = data.aws_iam_policy_document.alerts_sqs_policy.json
}

data "aws_iam_policy_document" "alerts_sqs_policy" {
  statement {
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["sns.amazonaws.com"]
    }
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.alerts_queue.arn]
    condition {
      test     = "ArnEquals"
      variable = "aws:SourceArn"
      values   = [aws_sns_topic.safety_alerts.arn]
    }
  }
}
