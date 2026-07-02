resource "aws_lambda_function" "query_api" {
  function_name = "smart-fleet-query-api"
  role          = aws_iam_role.lambda_execution.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 10
  memory_size   = 256

  filename         = "../lambdas/query-api/lambda.zip"
  source_code_hash = filebase64sha256("../lambdas/query-api/lambda.zip")

  environment {
    variables = {
      TELEMETRY_TABLE = aws_dynamodb_table.telemetry_events.name
      SUMMARIES_TABLE = aws_dynamodb_table.driver_summaries.name
    }
  }

  tracing_config {
    mode = "Active"
  }
}
