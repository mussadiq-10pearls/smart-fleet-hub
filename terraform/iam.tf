# ============================================================================
# LAMBDA EXECUTION ROLE - TRUST POLICY
# ============================================================================
# IAM policy document that defines a trust relationship allowing the AWS Lambda
# service to assume (use) the lambda_execution role. This is a prerequisite for
# any Lambda function to execute with the permissions defined in this role.
# Without this trust policy, Lambda cannot assume the role even if the role exists.
data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    effect = "Allow"
    # Allows the AWS Lambda service (lambda.amazonaws.com) to assume this role
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
    # sts:AssumeRole permission: allows the Lambda service to take on this role's
    # permissions when executing Lambda functions
    actions = ["sts:AssumeRole"]
  }
}

# ============================================================================
# LAMBDA EXECUTION ROLE (RESOURCE)
# ============================================================================
# Creates the IAM role that all Lambda functions will assume when executing.
# This role contains all the permissions that Lambda functions need to access
# AWS services (DynamoDB, SQS, SNS, CloudWatch, etc.).
# Name is descriptive to easily identify this role in AWS console and logs.
resource "aws_iam_role" "lambda_execution" {
  name = "smart-fleet-lambda-execution"
  # Attach the trust policy defined above: allows Lambda service to use this role
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

# ============================================================================
# AWS-MANAGED POLICY FOR LAMBDA BASIC EXECUTION
# ============================================================================
# Attaches the AWS-managed "AWSLambdaBasicExecutionRole" policy which grants:
#   - logs:CreateLogGroup, logs:CreateLogStream, logs:PutLogEvents
# This allows Lambda to write execution logs to CloudWatch Logs. Every Lambda
# function needs this policy to enable proper logging and debugging.
resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role = aws_iam_role.lambda_execution.name
  # ARN points to AWS-managed policy (maintained by AWS, not a custom policy)
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# ============================================================================
# CUSTOM INLINE POLICY FOR LAMBDA - SERVICE-SPECIFIC PERMISSIONS
# ============================================================================
# This custom policy grants permissions to access Smart Fleet-specific AWS
# services. Inline policies are directly attached to a role (vs managed policies
# which can be reused across roles). This policy defines the principle of least
# privilege by granting only necessary permissions for our Lambda functions.
resource "aws_iam_role_policy" "lambda_custom" {
  name = "lambda-custom-policy"
  role = aws_iam_role.lambda_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # ========================================================================
      # DYNAMODB PERMISSIONS - Telemetry, Summaries, and Alerts Tables
      # ========================================================================
      # These permissions allow Lambda functions to read and write data to
      # DynamoDB tables used by the Smart Fleet system.
      # Used by: telemetry-processor, alerts-persister, safety-scorer, query-api
      {
        Effect = "Allow"
        Action = [
          # dynamodb:PutItem - Write a single item to a DynamoDB table
          # Used by: telemetry-processor (persist raw telemetry),
          #          alerts-persister (persist alerts),
          #          safety-scorer (persist driver summaries)
          "dynamodb:PutItem",

          # dynamodb:GetItem - Fetch a single item by primary key
          # Currently not heavily used but included for future extensions
          "dynamodb:GetItem",

          # dynamodb:UpdateItem - Modify existing items in the table
          # Included for potential future updates to records
          "dynamodb:UpdateItem",

          # dynamodb:Query - Fetch multiple items using partition key and optional
          # sort key conditions. Efficient for range queries.
          # Used by: query-api (fetch telemetry for a specific vehicle)
          "dynamodb:Query",

          # dynamodb:Scan - Fetch all items from a table (full table scan)
          # Less efficient than Query but needed for batch operations
          # Used by: query-api (fetch all telemetry/scores/alerts),
          #          safety-scorer (scan recent telemetry)
          "dynamodb:Scan"
        ]
        # Apply these permissions to all three Smart Fleet tables
        Resource = [
          aws_dynamodb_table.telemetry_events.arn, # Raw vehicle telemetry data
          aws_dynamodb_table.driver_summaries.arn, # Calculated safety scores
          aws_dynamodb_table.alerts.arn,           # Safety violation alerts
          aws_dynamodb_table.vehicles.arn,         # Vehicle information
        ]
      },

      # ========================================================================
      # SQS PERMISSIONS - Raw Telemetry and Alerts Queues
      # ========================================================================
      # These permissions allow Lambda functions to send and receive messages
      # from SQS queues, enabling asynchronous processing pipelines.
      {
        Effect = "Allow"
        Action = [
          # sqs:SendMessage - Send a single message to an SQS queue
          # Used by: data-simulator (send one telemetry event at a time)
          "sqs:SendMessage",

          # sqs:SendMessageBatch - Send up to 10 messages in a single API call
          # More efficient than SendMessage when batching is possible
          # Used by: data-simulator (batch send telemetry from 5 vehicles)
          "sqs:SendMessageBatch",

          # sqs:ReceiveMessage - Poll the queue for new messages
          # Triggered automatically via event source mapping, but needed in the policy
          # Used by: telemetry-processor and alerts-persister (receive from event source)
          "sqs:ReceiveMessage",

          # sqs:DeleteMessage - Remove a successfully processed message from the queue
          # Prevents reprocessing of the same message
          # Used by: telemetry-processor and alerts-persister (after processing)
          "sqs:DeleteMessage",

          # sqs:GetQueueAttributes - Fetch queue metadata (e.g., message count, visibility timeout)
          # Used by monitoring and debugging; optional but useful for operational visibility
          "sqs:GetQueueAttributes"
        ]
        # Apply to both SQS queues in the pipeline
        Resource = [
          aws_sqs_queue.raw_telemetry.arn, # Input queue for telemetry data from simulator
          aws_sqs_queue.alerts_queue.arn   # Input queue for safety alerts (subscribed to SNS)
        ]
      },

      # ========================================================================
      # SNS PERMISSIONS - Safety Alerts Topic
      # ========================================================================
      # These permissions allow Lambda to publish messages to SNS topics.
      # SNS acts as a pub/sub broker, broadcasting alerts to all subscribers.
      {
        Effect = "Allow"
        # sns:Publish - Send a message to an SNS topic that will be delivered to
        # all subscribed endpoints (SQS queues, email, Lambda, etc.)
        # Used by: telemetry-processor (publish safety violation alerts)
        Action = "sns:Publish"
        # Apply to the safety alerts topic
        Resource = [aws_sns_topic.safety_alerts.arn]
      }
    ]
  })
}

# ============================================================================
# AWS EVENTBRIDGE SCHEDULER EXECUTION ROLE - TRUST POLICY & ROLE
# ============================================================================
# Creates a separate IAM role for AWS EventBridge Scheduler (managed scheduling
# service). Scheduler needs its own role because it has different trust
# requirements than Lambda. Scheduler triggers Lambda functions on a schedule
# (e.g., data-simulator periodically, safety-scorer every 24 hours).
resource "aws_iam_role" "scheduler_execution_role" {
  name = "smart-fleet-scheduler-role"
  # Trust policy: allows the EventBridge Scheduler service to assume this role
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        # scheduler.amazonaws.com is the AWS EventBridge Scheduler service principal
        Principal = {
          Service = "scheduler.amazonaws.com"
        }
        # sts:AssumeRole: allows Scheduler to use this role when executing scheduled tasks
        Action = "sts:AssumeRole"
      }
    ]
  })
}

# ============================================================================
# SCHEDULER POLICY - INVOKE LAMBDA FUNCTIONS
# ============================================================================
# This inline policy grants the EventBridge Scheduler permission to invoke
# (trigger) specific Lambda functions. Only the functions that should be
# scheduled are listed here, following the principle of least privilege.
# Functions NOT listed here cannot be triggered by Scheduler.
resource "aws_iam_role_policy" "scheduler_invoke_lambda" {
  role = aws_iam_role.scheduler_execution_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        # lambda:InvokeFunction - Permission to trigger/execute a Lambda function
        Action = "lambda:InvokeFunction"
        # Restrict to only these two Lambda functions:
        Resource = [
          # data-simulator: Invoked on a schedule to generate synthetic vehicle
          # telemetry and send it to SQS for processing
          aws_lambda_function.data_simulator.arn,

          # safety-scorer: Invoked on a schedule (e.g., every x time interval) to scan
          # recent telemetry, calculate safety scores, and persist summaries
          aws_lambda_function.safety_scorer.arn
        ]
      }
    ]
  })
}
