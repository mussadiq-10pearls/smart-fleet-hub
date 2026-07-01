resource "aws_dynamodb_table" "telemetry_events" {
  name         = "TelemetryEvents"
  billing_mode = "PAY_PER_REQUEST" # On-demand, cost-effective for variable traffic
  hash_key     = "vehicleId"
  range_key    = "timestamp"

  attribute {
    name = "vehicleId"
    type = "S" # String
  }
  attribute {
    name = "timestamp"
    type = "N" # Number (Unix epoch time)
  }

  tags = {
    Environment = "demo"
    Project     = "smart-fleet-hub"
  }
}
