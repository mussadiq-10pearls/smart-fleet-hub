resource "aws_sns_topic" "safety_alerts" {
  name = "safety-alerts-topic"
  tags = {
    Environment = "demo"
    Project     = "smart-fleet-hub"
  }
}

# Optional: email subscription for demo purposes (you'll receive emails)
# Replace with your email to see alerts
resource "aws_sns_topic_subscription" "email_alert" {
  topic_arn = aws_sns_topic.safety_alerts.arn
  protocol  = "email"
  endpoint  = "mussadiqchhipa@gmail.com"
}
