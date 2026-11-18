variable "name" {
  type        = string
  description = "Name of the ECR repository"
}

variable "keep_images" {
  type        = number
  description = "How many images the lifecycle policy keeps; older ones are expired"
  default     = 10
}

variable "tags" {
  type        = map(string)
  description = "Map of tags"
  default     = {}
}
