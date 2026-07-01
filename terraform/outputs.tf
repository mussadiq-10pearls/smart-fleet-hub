output "api_endpoint" {
  value = aws_apigatewayv2_api.fleet_api.api_endpoint
}

output "cloudfront_url" {
  value = aws_cloudfront_distribution.frontend.domain_name
}
