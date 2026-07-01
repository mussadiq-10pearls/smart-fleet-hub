# IAM policy document - trust policy allowing Lambda service to assume this role
data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
    actions = ["sts:AssumeRole"]
  }
}

# The IAM role itself
resource "aws_iam_role" "lambda_execution" {
  name               = "smart-fleet-lambda-execution"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

# Attach the AWS-managed policy for basic Lambda execution (CloudWatch logs)
resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Custom inline policy for DynamoDB, SNS, SQS (we'll expand as we go)
resource "aws_iam_role_policy" "lambda_custom" {
  name = "lambda-custom-policy"
  role = aws_iam_role.lambda_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.telemetry_events.arn,
          aws_dynamodb_table.driver_summaries.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:SendMessageBatch",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = [aws_sqs_queue.raw_telemetry.arn]
      },
      {
        Effect   = "Allow"
        Action   = "sns:Publish"
        Resource = [aws_sns_topic.safety_alerts.arn]
      }
    ]
  })
}

resource "aws_iam_role" "scheduler_execution_role" {
  name = "smart-fleet-scheduler-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "scheduler.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy" "scheduler_invoke_lambda" {
  role = aws_iam_role.scheduler_execution_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = "lambda:InvokeFunction"
        Resource = [
          aws_lambda_function.data_simulator.arn,
          aws_lambda_function.safety_scorer.arn
        ]
      }
    ]
  })
}
