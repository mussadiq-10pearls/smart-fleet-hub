# HTTP API
resource "aws_apigatewayv2_api" "fleet_api" {
  name          = "smart-fleet-api"
  protocol_type = "HTTP"
  cors_configuration {
    allow_origins     = ["*"]
    allow_methods     = ["GET"]
    allow_headers     = ["authorization", "content-type", "x-amz-date", "x-api-key", "x-amz-security-token"]
    allow_credentials = false
    max_age           = 3600
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
  api_id             = aws_apigatewayv2_api.fleet_api.id
  route_key          = "GET /telemetry"
  target             = "integrations/${aws_apigatewayv2_integration.query_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "scores_route" {
  api_id             = aws_apigatewayv2_api.fleet_api.id
  route_key          = "GET /scores"
  target             = "integrations/${aws_apigatewayv2_integration.query_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
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

resource "aws_apigatewayv2_route" "alerts_route" {
  api_id             = aws_apigatewayv2_api.fleet_api.id
  route_key          = "GET /alerts"
  target             = "integrations/${aws_apigatewayv2_integration.query_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

# ---------- JWT Authorizer ----------
resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.fleet_api.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "cognito-authorizer"
  jwt_configuration {
    audience = [aws_cognito_user_pool_client.fleet_client.id]
    issuer   = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.fleet.id}"
  }
}

resource "aws_apigatewayv2_route" "vehicles_route" {
  api_id             = aws_apigatewayv2_api.fleet_api.id
  route_key          = "GET /vehicles"
  target             = "integrations/${aws_apigatewayv2_integration.query_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}
