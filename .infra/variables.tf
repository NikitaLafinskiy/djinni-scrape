variable "aws_region" {
  type        = string
  description = "AWS region"
  default     = "eu-central-1"
}

variable "image_tag" {
  type        = string
  description = "Tag of the image in the ECR repository that all three functions run (scripts/deploy.sh passes the git SHA)"
}

variable "schedule_expression" {
  type        = string
  description = "EventBridge Scheduler expression for the dispatcher, e.g. cron(0 9 * * ? *) or rate(12 hours)"
  default     = "cron(0 9 * * ? *)"
}

variable "schedule_timezone" {
  type        = string
  description = "Timezone the schedule expression is evaluated in"
  default     = "Europe/Warsaw"
}

variable "admin_basic_auth_parameter" {
  type        = string
  description = "Path of the SecureString SSM parameter holding the admin panel's \"user:password\". Created by hand so the secret never enters Terraform state."
  default     = "/djinni-scrape/admin-basic-auth"
}

variable "ses_sender_email" {
  type        = string
  description = "Already-verified SES email identity the run summaries are sent from. Not managed here - only the scraper's permission to send from it is."
  default     = "niklafinskiy@gmail.com"
}

variable "captcha_api_key_parameter" {
  type        = string
  description = "Path of the SecureString SSM parameter holding the 2captcha API key the scraper uses for No Fluff Jobs captchas. Created by hand so the key never enters Terraform state."
  default     = "/djinni-scrape/2captcha-api-key"
}

variable "melious_api_key_parameter" {
  type        = string
  description = "Path of the SecureString SSM parameter holding the Melious API key the scraper uses to answer recruiter questions with glm-5.3-flash. Created by hand so the key never enters Terraform state."
  default     = "/djinni-scrape/melious-api-key"
}
