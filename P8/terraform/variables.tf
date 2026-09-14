variable "kubeconfig" {
  description = "Ruta al kubeconfig utilizado únicamente por Terraform localmente."
  type        = string
  default     = null
}

variable "application_namespace" {
  type    = string
  default = "sa-p8"
}

variable "analysis_service_account" {
  type    = string
  default = "p8-analysis"
}
