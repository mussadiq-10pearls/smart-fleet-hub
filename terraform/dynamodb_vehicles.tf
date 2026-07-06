resource "aws_dynamodb_table" "vehicles" {
  name         = "Vehicles"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "vehicleId"

  attribute {
    name = "vehicleId"
    type = "S"
  }

  tags = {
    Environment = "demo"
    Project     = "smart-fleet-hub"
  }
}


resource "aws_dynamodb_table_item" "vehicle_101" {
  table_name = aws_dynamodb_table.vehicles.name
  hash_key   = "vehicleId"
  item       = jsonencode({ vehicleId = { S = "V-101" } })
}

resource "aws_dynamodb_table_item" "vehicle_202" {
  table_name = aws_dynamodb_table.vehicles.name
  hash_key   = "vehicleId"
  item       = jsonencode({ vehicleId = { S = "V-202" } })
}

resource "aws_dynamodb_table_item" "vehicle_303" {
  table_name = aws_dynamodb_table.vehicles.name
  hash_key   = "vehicleId"
  item       = jsonencode({ vehicleId = { S = "V-303" } })
}

resource "aws_dynamodb_table_item" "vehicle_404" {
  table_name = aws_dynamodb_table.vehicles.name
  hash_key   = "vehicleId"
  item       = jsonencode({ vehicleId = { S = "V-404" } })
}

resource "aws_dynamodb_table_item" "vehicle_505" {
  table_name = aws_dynamodb_table.vehicles.name
  hash_key   = "vehicleId"
  item       = jsonencode({ vehicleId = { S = "V-505" } })
}
