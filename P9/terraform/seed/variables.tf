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
variable "state_bucket" {
  type    = string
  default = "comicrent-p9-tf-2026-202307705"
}
variable "velero_bucket" {
  type    = string
  default = "comicrent-p9-velero-2026-202307705"
}
variable "backup_retention_days" {
  type    = number
  default = 30
}
