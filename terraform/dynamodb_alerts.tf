resource "aws_dynamodb_table" "alerts" {
  name         = "SafetyAlerts"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "alertId"
  range_key    = "timestamp"

  attribute {
    name = "alertId"
    type = "S"
  }
  attribute {
    name = "timestamp"
    type = "N"
  }

  tags = {
    Environment = "demo"
    Project     = "smart-fleet-hub"
  }
}
