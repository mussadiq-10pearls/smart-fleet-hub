# HTTP API
resource "aws_apigatewayv2_api" "fleet_api" {
  name          = "smart-fleet-api"
  protocol_type = "HTTP"
  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET"]
    allow_headers = ["*"]
  }
}

# Lambda integration
resource "aws_apigatewayv2_integration" "query_lambda" {
  api_id                 = aws_apigatewayv2_api.fleet_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.query_api.invoke_arn
  payload_format_version = "2.0"
}

# Routes
resource "aws_apigatewayv2_route" "telemetry_route" {
  api_id    = aws_apigatewayv2_api.fleet_api.id
  route_key = "GET /telemetry"
  target    = "integrations/${aws_apigatewayv2_integration.query_lambda.id}"
}

resource "aws_apigatewayv2_route" "scores_route" {
  api_id    = aws_apigatewayv2_api.fleet_api.id
  route_key = "GET /scores"
  target    = "integrations/${aws_apigatewayv2_integration.query_lambda.id}"
}

# Stage (auto-deploy)
resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.fleet_api.id
  name        = "$default"
  auto_deploy = true
}

# Permission for API Gateway to invoke Lambda
resource "aws_lambda_permission" "query_api_apigw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.query_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.fleet_api.execution_arn}/*/*"
}
