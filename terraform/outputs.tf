output "api_endpoint" {
  value = aws_apigatewayv2_api.fleet_api.api_endpoint
}

output "cloudfront_url" {
  value = aws_cloudfront_distribution.frontend.domain_name
}

# Cognito
output "cognito_user_pool_id" {
  value = aws_cognito_user_pool.fleet.id
}

output "cognito_app_client_id" {
  value = aws_cognito_user_pool_client.fleet_client.id
}

output "cognito_domain" {
  value = "https://${aws_cognito_user_pool_domain.fleet_domain.domain}.auth.${var.aws_region}.amazoncognito.com"
}
