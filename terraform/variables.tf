variable "region" {
  description = "Primary AWS region"
  type        = string
  default     = "ap-south-1"   # Mumbai
}
variable "env" {
  description = "Deployment environment (dev|staging|prod)"
  type        = string
  default     = "prod"
}
