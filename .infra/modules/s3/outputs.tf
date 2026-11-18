output "id" {
  value = aws_s3_bucket.this.id
}

output "arn" {
  value = aws_s3_bucket.this.arn
}

output "name" {
  value = aws_s3_bucket.this.bucket
}

output "regional_domain_name" {
  value       = aws_s3_bucket.this.bucket_regional_domain_name
  description = "Regional domain name of the bucket (e.g. bucket-name.s3.us-east-1.amazonaws.com)"
}


output "website_endpoint" {
  value       = one(aws_s3_bucket_website_configuration.this[*].website_endpoint)
  description = "Static website endpoint (HTTP only), or null when the bucket is not public"
}
