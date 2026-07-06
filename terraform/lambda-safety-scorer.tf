resource "aws_lambda_function" "safety_scorer" {
  function_name = "smart-fleet-safety-scorer"
  role          = aws_iam_role.lambda_execution.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 60
  memory_size   = 512

  filename         = "../lambdas/safety-scorer/lambda.zip"
  source_code_hash = filebase64sha256("../lambdas/safety-scorer/lambda.zip")

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

resource "aws_scheduler_schedule" "safety_scorer_cron" {
  name        = "safety-scorer-every-1hour"
  group_name  = "default"
  description = "Generate driver safety scores every 1 hour"

  flexible_time_window {
    mode = "OFF"
  }

  schedule_expression = "rate(12 hours)" # 1 hour

  target {
    arn      = aws_lambda_function.safety_scorer.arn
    role_arn = aws_iam_role.scheduler_execution_role.arn
  }

}
