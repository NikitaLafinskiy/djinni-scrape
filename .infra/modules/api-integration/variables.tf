variable "api_gateway_id" {
  type        = string
  description = "ID of the API Gateway"
}

variable "api_gateway_execution_arn" {
  type        = string
  description = "Execution ARN of the API Gateway"
}

variable "lambda_function_name" {
  type        = string
  description = "Name of the Lambda function to invoke"
}

variable "lambda_invoke_arn" {
  type        = string
  description = "Invoke ARN of the Lambda function"
}

variable "lambda_alias_name" {
  type        = string
  description = "Name of the Lambda alias (qualifier) that permission to invoke is scoped to"
}

variable "payload_format_version" {
  type        = string
  description = "Lambda proxy payload format. 1.0 is the AwsProxyRequest shape StreamLambdaHandler expects; 2.0 is the HTTP API format."
  default     = "1.0"

  validation {
    condition     = contains(["1.0", "2.0"], var.payload_format_version)
    error_message = "payload_format_version must be 1.0 or 2.0."
  }
}

variable "routes" {
  type = list(object({
    path               = string
    method             = string
    authorization_type = optional(string, "NONE")
  }))
  description = "API Gateway route configurations (fmt: method = 'ANY', path = '/api/auth/{proxy+}'). authorization_type is NONE or AWS_IAM; an AWS_IAM route only answers SigV4-signed callers granted execute-api:Invoke on it."

  validation {
    condition     = alltrue([for r in var.routes : contains(["NONE", "AWS_IAM"], r.authorization_type)])
    error_message = "authorization_type must be NONE or AWS_IAM."
  }
}

variable "tags" {
  type        = map(string)
  description = "Map of tags"
  default     = {}
}
