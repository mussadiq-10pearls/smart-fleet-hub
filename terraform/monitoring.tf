resource "aws_cloudwatch_dashboard" "fleet_dashboard" {
  dashboard_name = "SmartFleetHub"

  dashboard_body = jsonencode({
    widgets = [
      # Queue metrics
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", aws_sqs_queue.raw_telemetry.name],
            ["AWS/SQS", "ApproximateNumberOfMessagesDelayed", "QueueName", aws_sqs_queue.raw_telemetry.name],
            ["AWS/SQS", "ApproximateNumberOfMessagesNotVisible", "QueueName", aws_sqs_queue.raw_telemetry.name]
          ]
          period = 60
          stat   = "Average"
          region = "us-east-1"
          title  = "SQS: raw-telemetry-queue"
        }
      },
      # Lambda invocations and errors
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/Lambda", "Invocations", "FunctionName", aws_lambda_function.telemetry_processor.function_name],
            ["AWS/Lambda", "Errors", "FunctionName", aws_lambda_function.telemetry_processor.function_name],
            ["AWS/Lambda", "Duration", "FunctionName", aws_lambda_function.telemetry_processor.function_name, { "stat" : "Average" }]
          ]
          period = 60
          stat   = "Sum"
          region = "us-east-1"
          title  = "Telemetry Processor Lambda"
        }
      },
      # API Gateway metrics
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/ApiGateway", "Count", "ApiName", aws_apigatewayv2_api.fleet_api.name],
            ["AWS/ApiGateway", "Latency", "ApiName", aws_apigatewayv2_api.fleet_api.name, { "stat" : "Average" }],
            ["AWS/ApiGateway", "4xx", "ApiName", aws_apigatewayv2_api.fleet_api.name]
          ]
          period = 60
          stat   = "Sum"
          region = "us-east-1"
          title  = "API Gateway"
        }
      },
      # DynamoDB consumed capacity
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", aws_dynamodb_table.telemetry_events.name],
            ["AWS/DynamoDB", "ConsumedWriteCapacityUnits", "TableName", aws_dynamodb_table.telemetry_events.name]
          ]
          period = 60
          stat   = "Sum"
          region = "us-east-1"
          title  = "DynamoDB Capacity (TelemetryEvents)"
        }
      }
    ]
  })
}

resource "aws_cloudwatch_metric_alarm" "dlq_depth" {
  alarm_name          = "smart-fleet-dlq-depth"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Alarm when messages appear in the telemetry DLQ"
  alarm_actions       = [aws_sns_topic.safety_alerts.arn]

  dimensions = {
    QueueName = aws_sqs_queue.telemetry_dlq.name
  }
}
