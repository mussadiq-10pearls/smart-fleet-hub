resource "aws_lambda_function" "telemetry_processor" {
  function_name = "smart-fleet-telemetry-processor"
  role          = aws_iam_role.lambda_execution.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 30
  memory_size   = 256

  filename         = "../lambdas/telemetry-processor/dist/lambda.zip"
  source_code_hash = filebase64sha256("../lambdas/telemetry-processor/dist/lambda.zip")

  environment {
    variables = {
      TABLE_NAME    = aws_dynamodb_table.telemetry_events.name
      SNS_TOPIC_ARN = aws_sns_topic.safety_alerts.arn
    }
  }
}

# SQS Event Source Mapping – connects the queue to the Lambda
resource "aws_lambda_event_source_mapping" "telemetry_sqs_trigger" {
  event_source_arn = aws_sqs_queue.raw_telemetry.arn
  function_name    = aws_lambda_function.telemetry_processor.arn
  batch_size       = 10 # how many messages to pull at once
  enabled          = true
}
