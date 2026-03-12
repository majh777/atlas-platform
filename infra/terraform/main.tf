terraform {
  required_version = ">= 1.6.0"
}

variable "environment" {
  type    = string
  default = "staging"
}

locals {
  tags = {
    project = "atlas"
    module  = "12-devsecops"
    env     = var.environment
  }
}

output "release_controls" {
  value = {
    deployment_strategy = "blue-green"
    rollback_support    = true
    tracing             = "otel"
    dashboards          = ["release-health", "service-map"]
  }
}
