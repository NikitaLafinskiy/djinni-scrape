resource "aws_apigatewayv2_api" "this" {
  name          = "${var.name}-api"
  protocol_type = "HTTP"

  dynamic "cors_configuration" {
    for_each = var.cors_configuration == null ? [] : [var.cors_configuration]
    content {
      allow_origins = cors_configuration.value.allow_origins
      allow_methods = cors_configuration.value.allow_methods
      allow_headers = cors_configuration.value.allow_headers
      max_age       = cors_configuration.value.max_age
    }
  }

  tags = var.tags
}

resource "aws_cloudwatch_log_group" "this" {
  name              = "/aws/apigateway/${aws_apigatewayv2_api.this.id}"
  retention_in_days = var.log_retention_days

  tags = var.tags
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.this.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.this.arn
    format = jsonencode({
      requestId               = "$context.requestId"
      ip                      = "$context.identity.sourceIp"
      requestTime             = "$context.requestTime"
      httpMethod              = "$context.httpMethod"
      routeKey                = "$context.routeKey"
      status                  = "$context.status"
      protocol                = "$context.protocol"
      responseLength          = "$context.responseLength"
      integrationErrorMessage = "$context.integrationErrorMessage"
    })
  }

  tags = var.tags
}
