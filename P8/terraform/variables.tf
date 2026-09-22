variable "project_id" {
  description = "Proyecto de Google Cloud que alojará GKE."
  type        = string
  default     = "comicrent-p6-2026"
}

variable "region" {
  type    = string
  default = "us-central1"
}

variable "zone" {
  type    = string
  default = "us-central1-a"
}

variable "cluster_name" {
  type    = string
  default = "comicrent-gke-p6"
}

variable "node_pool_name" {
  type    = string
  default = "default-pool"
}

variable "node_count" {
  description = "Nodos necesarios para ejecutar la plataforma y ComicRent durante la demostración."
  type        = number
  default     = 3
}

variable "machine_type" {
  type    = string
  default = "e2-standard-2"
}

variable "network" {
  type    = string
  default = "default"
}

variable "subnetwork" {
  type    = string
  default = "default"
}

variable "master_authorized_cidr" {
  description = "CIDR público autorizado para acceder al control plane de GKE, normalmente IP/32."
  type        = string

  validation {
    condition     = can(cidrhost(var.master_authorized_cidr, 0)) && var.master_authorized_cidr != "0.0.0.0/0"
    error_message = "Use un CIDR válido y restringido; no se permite 0.0.0.0/0."
  }
}

variable "sealed_secrets_cert_path" {
  description = "Ruta local al certificado público persistente de Sealed Secrets. Nunca se versiona."
  type        = string
  default     = "~/.comicrent/p8-sealed-secrets/tls.crt"
}

variable "sealed_secrets_key_path" {
  description = "Ruta local a la clave privada persistente de Sealed Secrets. Nunca se versiona."
  type        = string
  sensitive   = true
  default     = "~/.comicrent/p8-sealed-secrets/tls.key"
}

variable "application_namespace" {
  type    = string
  default = "sa-p8"
}

variable "analysis_service_account" {
  type    = string
  default = "p8-analysis"
}
