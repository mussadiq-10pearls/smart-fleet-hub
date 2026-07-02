resource "aws_sns_topic" "safety_alerts" {
  name = "safety-alerts-topic"
  tags = {
    Environment = "demo"
    Project     = "smart-fleet-hub"
  }
}

resource "aws_sns_topic_subscription" "alerts_sqs" {
  topic_arn = aws_sns_topic.safety_alerts.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.alerts_queue.arn
}
