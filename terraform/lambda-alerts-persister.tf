resource "aws_lambda_function" "alerts_persister" {
  function_name = "smart-fleet-alerts-persister"
  role          = aws_iam_role.lambda_execution.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 10
  memory_size   = 256

  filename         = "../lambdas/alerts-persister/lambda.zip"
  source_code_hash = filebase64sha256("../lambdas/alerts-persister/lambda.zip")

  environment {
    variables = {
      ALERTS_TABLE = aws_dynamodb_table.alerts.name
    }
  }

  tracing_config {
    mode = "Active"
  }
}

resource "aws_lambda_event_source_mapping" "alerts_sqs_trigger" {
  event_source_arn = aws_sqs_queue.alerts_queue.arn
  function_name    = aws_lambda_function.alerts_persister.arn
  batch_size       = 10
  enabled          = true
}
