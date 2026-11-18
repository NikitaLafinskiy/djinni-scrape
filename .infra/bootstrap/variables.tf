variable "aws_region" {
  type        = string
  description = "AWS region"
  default     = "eu-central-1"
}

variable "state_bucket_name" {
  type        = string
  description = "Globally-unique name for the Terraform remote state bucket"
  default     = "djinni-scrape-statetf"
}

variable "tags" {
  type        = map(string)
  description = "Map of tags"
  default     = {}
}
