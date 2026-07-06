# ---------- User Pool ----------
resource "aws_cognito_user_pool" "fleet" {
  name = "smart-fleet-pool"

  # Allow users to sign up (optional; we'll create a demo user manually)
  admin_create_user_config {
    allow_admin_create_user_only = true
  }

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false
    require_uppercase = false
  }

  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = true
  }

  tags = {
    Environment = "demo"
    Project     = "smart-fleet-hub"
  }
}

# ---------- App Client (PKCE, no secret) ----------
resource "aws_cognito_user_pool_client" "fleet_client" {
  name                                 = "fleet-dashboard"
  user_pool_id                         = aws_cognito_user_pool.fleet.id
  generate_secret                      = false # Public client
  callback_urls                        = ["https://${aws_cloudfront_distribution.frontend.domain_name}/index.html"]
  logout_urls                          = ["https://${aws_cloudfront_distribution.frontend.domain_name}/", "https://${aws_cloudfront_distribution.frontend.domain_name}"]
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_scopes                 = ["openid", "email", "profile"]
  supported_identity_providers         = ["COGNITO"]
  explicit_auth_flows                  = ["ALLOW_USER_SRP_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]
  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }
  access_token_validity  = 1
  id_token_validity      = 1
  refresh_token_validity = 7
}

# ---------- Domain (Hosted UI) ----------
resource "aws_cognito_user_pool_domain" "fleet_domain" {
  domain       = "smart-fleet-${data.aws_caller_identity.current.account_id}"
  user_pool_id = aws_cognito_user_pool.fleet.id
}

# ---------- Demo User (manual creation, or use AWS CLI) ----------
# We'll create a demo user via CLI after deployment, or via Terraform resource:
# resource "aws_cognito_user" "demo" {
#   user_pool_id = aws_cognito_user_pool.fleet.id
#   username     = "fleetmanager"
#   password     = "DemoPassword123!"   # would need to be set via temporary password, then forced reset
# }
# For simplicity, we'll use the CLI to create a user after the pool is created.
