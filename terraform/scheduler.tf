resource "aws_scheduler_schedule" "data_simulator_cron" {
  name        = "data-simulator-every-2-minutes"
  group_name  = "default"
  description = "Trigger data simulator Lambda every 2 minutes"

  flexible_time_window {
    mode = "OFF"
  }

  schedule_expression = "rate(12 hours)" # every 5 hours, later change to "rate(2 minutes)"

  target {
    arn      = aws_lambda_function.data_simulator.arn
    role_arn = aws_iam_role.scheduler_execution_role.arn # we'll define next
  }
}
