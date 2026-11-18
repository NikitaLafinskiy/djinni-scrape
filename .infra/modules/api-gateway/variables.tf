variable "name" {
  type        = string
  description = "Base name used for API Gateway resources"
}
variable "cors_configuration" {
  type = object({
    allow_origins = list(string)
    allow_methods = list(string)
    allow_headers = list(string)
    max_age       = optional(number, 3600)
  })
  description = "CORS settings; API Gateway then answers preflight OPTIONS requests itself. null (the default) disables CORS."
  default     = null
}

variable "log_retention_days" {
  type        = number
  description = "Days CloudWatch keeps the stage's access logs"
  default     = 180
}

variable "tags" {
  type        = map(string)
  description = "Map of tags"
  default     = {}
}
