resource "aws_dynamodb_table" "driver_summaries" {
  name         = "DriverSummaries"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "vehicleId"
  range_key    = "summaryDate"

  attribute {
    name = "vehicleId"
    type = "S"
  }
  attribute {
    name = "summaryDate"
    type = "S"
  }

  tags = {
    Environment = "demo"
    Project     = "smart-fleet-hub"
  }
}
