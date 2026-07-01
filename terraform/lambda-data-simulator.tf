resource "aws_lambda_function" "data_simulator" {
  function_name = "smart-fleet-data-simulator"
  role          = aws_iam_role.lambda_execution.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 30
  memory_size   = 256

  # We'll use a ZIP file; for now, use a dummy zip (we'll automate later)
  # For the first test, we'll upload manually via AWS CLI.
  # In the full CI/CD, GitHub Actions will build and deploy.
  filename         = "../lambdas/data-simulator/lambda.zip" # we'll create this
  source_code_hash = filebase64sha256("../lambdas/data-simulator/lambda.zip")

  environment {
    variables = {
      QUEUE_URL = aws_sqs_queue.raw_telemetry.url
    }
  }
}
