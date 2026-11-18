output "ui_url" {
  description = "Admin panel over HTTPS - use this one so the basic auth credentials are never typed into a plain HTTP page"
  value       = "${local.ui_https_origin}/index.html"
}

output "ui_website_url" {
  description = "Admin panel on the S3 static website endpoint (HTTP only)"
  value       = "http://${module.ui_bucket.website_endpoint}"
}

output "api_endpoint" {
  description = "Invoke URL of the admin API"
  value       = module.api_gateway.api_endpoint
}

output "dsql_endpoint" {
  description = "Bare DSQL cluster host, for scripts/migrate.ts and psql"
  value       = module.dsql.endpoint
}

output "ecr_repository_url" {
  description = "Repository scripts/deploy.sh pushes the image to"
  value       = module.ecr.repository_url
}

output "lambda_role_arns" {
  description = "Execution roles mapped to the djinni_app database role by scripts/migrate.ts"
  value       = [module.scraper.role_arn, module.dispatcher.role_arn, module.api.role_arn]
}

output "scrape_queue_url" {
  value = module.scrape_queue.queue_url
}

output "dispatcher_function_name" {
  value = module.dispatcher.function_name
}
