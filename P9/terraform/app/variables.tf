variable "project_id" {
  type    = string
  default = "comicrent-p6-2026"
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
  type    = number
  default = 3
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
  type = string
  validation {
    condition     = can(cidrhost(var.master_authorized_cidr, 0)) && var.master_authorized_cidr != "0.0.0.0/0"
    error_message = "Use un CIDR válido y restringido; no se permite 0.0.0.0/0."
  }
}
variable "state_bucket" {
  type    = string
  default = "comicrent-p9-tf-2026-202307705"
}
variable "gitops_repo" {
  type    = string
  default = "https://github.com/DavidVelasquez77/Practicas-SA-B-202307705-gitops.git"
}
variable "gitops_revision" {
  type    = string
  default = "main"
}
