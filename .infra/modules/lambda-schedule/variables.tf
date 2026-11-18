variable "name" {
  type        = string
  description = "Name of the schedule, also the prefix of its IAM role and policy"
}

variable "lambda_arn" {
  type        = string
  description = "ARN of the Lambda function or alias the schedule invokes"
}

variable "schedule_expression" {
  type        = string
  description = "EventBridge Scheduler expression, e.g. cron(0 3 ? * MON *) or rate(7 days)"
}

variable "schedule_expression_timezone" {
  type        = string
  description = "Timezone the schedule expression is evaluated in"
  default     = "UTC"
}

variable "input" {
  type        = string
  description = "JSON event the function is invoked with on every run, delivered verbatim"
  default     = "{}"
}

variable "state" {
  type        = string
  description = "ENABLED or DISABLED; a disabled schedule sends nothing until it is switched on"
  default     = "ENABLED"

  validation {
    condition     = contains(["ENABLED", "DISABLED"], var.state)
    error_message = "state must be ENABLED or DISABLED."
  }
}

variable "tags" {
  type        = map(string)
  description = "Map of tags for the IAM role; Scheduler schedules take no tags"
  default     = {}
}
