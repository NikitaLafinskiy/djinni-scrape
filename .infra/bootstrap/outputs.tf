output "state_bucket" {
  description = "Name of the S3 bucket to use as the Terraform S3 backend `bucket`"
  value       = aws_s3_bucket.tfstate.bucket
}
