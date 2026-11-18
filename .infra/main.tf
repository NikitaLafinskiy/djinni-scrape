data "aws_caller_identity" "current" {}

locals {
  name      = "djinni-scrape"
  tags      = {}
  image_uri = "${module.ecr.repository_url}:${var.image_tag}"

  ui_bucket_name   = "${local.name}-admin-${data.aws_caller_identity.current.account_id}"
  ui_https_origin  = "https://${local.ui_bucket_name}.s3.${var.aws_region}.amazonaws.com"
  ui_source_dir    = "${path.module}/../ui"
  ui_content_types = { html = "text/html", js = "text/javascript", css = "text/css", svg = "image/svg+xml" }

  lambda_environment = {
    DSQL_CLUSTER_ENDPOINT = module.dsql.endpoint
    SCRAPE_QUEUE_URL      = module.scrape_queue.queue_url
  }
}

module "ecr" {
  source = "./modules/ecr"

  name = local.name
  tags = local.tags
}

module "dsql" {
  source = "./modules/aurora-dsql"

  name                        = "${local.name}-dsql"
  deletion_protection_enabled = true
  tags                        = local.tags
}

# Visibility timeout is 6x the scraper's 900s timeout, so a long scrape is not
# delivered again mid-flight. A failed URL is retried once before the DLQ.
module "scrape_queue" {
  source = "./modules/sqs"

  name                       = "${local.name}-queue"
  dlq_name                   = "${local.name}-dlq"
  visibility_timeout_seconds = 5400
  max_receive_count          = 2
  tags                       = local.tags
}

module "scraper" {
  source = "./modules/lambda"

  name              = "${local.name}-scraper"
  package_type      = "Image"
  image_uri         = local.image_uri
  image_command     = ["dist/handlers/scraper.handler"]
  memory_size       = 3008
  timeout           = 900
  dsql_cluster_arns = [module.dsql.arn]
  sqs_queue_arns    = [module.scrape_queue.queue_arn]
  ses_identity_arns = ["arn:aws:ses:${var.aws_region}:${data.aws_caller_identity.current.account_id}:identity/${var.ses_sender_email}"]
  ssm_parameter_paths = {
    "captcha-api-key" = var.captcha_api_key_parameter
    "melious-api-key" = var.melious_api_key_parameter
  }
  environment_variables = merge(local.lambda_environment, { SES_SENDER_EMAIL = var.ses_sender_email })
  log_retention_days    = 30
  tags                  = local.tags
}

module "dispatcher" {
  source = "./modules/lambda"

  name                  = "${local.name}-dispatcher"
  package_type          = "Image"
  image_uri             = local.image_uri
  image_command         = ["dist/handlers/dispatcher.handler"]
  memory_size           = 512
  timeout               = 60
  dsql_cluster_arns     = [module.dsql.arn]
  sqs_queue_arns        = [module.scrape_queue.queue_arn]
  environment_variables = local.lambda_environment
  log_retention_days    = 30
  tags                  = local.tags
}

module "api" {
  source = "./modules/lambda"

  name                  = "${local.name}-api"
  package_type          = "Image"
  image_uri             = local.image_uri
  image_command         = ["dist/handlers/api.handler"]
  memory_size           = 512
  timeout               = 29
  dsql_cluster_arns     = [module.dsql.arn]
  sqs_queue_arns        = [module.scrape_queue.queue_arn]
  ssm_parameter_paths   = { "admin-basic-auth" = var.admin_basic_auth_parameter }
  environment_variables = local.lambda_environment
  log_retention_days    = 30
  tags                  = local.tags
}

# Batch size 1 gives every URL its own invocation; concurrency 2 (the minimum)
# limits how many djinni sessions run at once.
module "scrape_queue_esm" {
  source = "./modules/sqs-event-source-mapping"

  sqs_arn             = module.scrape_queue.queue_arn
  lambda_arn          = module.scraper.alias_arn
  batch_size          = 1
  maximum_concurrency = 2

  depends_on = [module.scraper]
}

module "dispatch_schedule" {
  source = "./modules/lambda-schedule"

  name                         = "${local.name}-dispatch"
  lambda_arn                   = module.dispatcher.alias_arn
  schedule_expression          = var.schedule_expression
  schedule_expression_timezone = var.schedule_timezone
  tags                         = local.tags
}

module "api_gateway" {
  source = "./modules/api-gateway"

  name = local.name
  cors_configuration = {
    allow_origins = [local.ui_https_origin, "http://${module.ui_bucket.website_endpoint}"]
    allow_methods = ["GET", "POST", "PATCH", "DELETE"]
    allow_headers = ["authorization", "content-type"]
  }
  log_retention_days = 30
  tags               = local.tags
}

module "api_integration" {
  source = "./modules/api-integration"

  api_gateway_id            = module.api_gateway.api_id
  api_gateway_execution_arn = module.api_gateway.execution_arn
  lambda_function_name      = module.api.function_name
  lambda_invoke_arn         = module.api.invoke_arn
  lambda_alias_name         = module.api.alias_name
  payload_format_version    = "2.0"
  # Not ANY: that would also match OPTIONS and send CORS preflights, which
  # carry no Authorization header, to the function instead of letting API
  # Gateway answer them from cors_configuration.
  routes = [
    for method in ["GET", "POST", "PATCH", "DELETE"] : { method = method, path = "/{proxy+}" }
  ]
  tags = local.tags
}

# Public on purpose: the files hold no data, every API call is checked
# against the basic auth credentials by the api function.
module "ui_bucket" {
  source = "./modules/s3"

  name                    = local.ui_bucket_name
  is_public               = true
  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
  tags                    = local.tags
}

resource "aws_s3_object" "ui" {
  for_each = toset([for file in fileset(local.ui_source_dir, "**") : file if file != "config.js"])

  bucket        = module.ui_bucket.id
  key           = each.value
  source        = "${local.ui_source_dir}/${each.value}"
  etag          = filemd5("${local.ui_source_dir}/${each.value}")
  content_type  = lookup(local.ui_content_types, reverse(split(".", each.value))[0], "application/octet-stream")
  cache_control = "no-cache"
}

resource "aws_s3_object" "ui_config" {
  bucket        = module.ui_bucket.id
  key           = "config.js"
  content       = "window.DJINNI_CONFIG = ${jsonencode({ apiUrl = trimsuffix(module.api_gateway.api_endpoint, "/") })};\n"
  content_type  = "text/javascript"
  cache_control = "no-cache"
}
