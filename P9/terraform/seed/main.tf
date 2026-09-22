terraform {
  backend "gcs" {
    bucket = "comicrent-p9-tf-2026-202307705"
    prefix = "p9/seed"
  }
  required_version = ">= 1.6.0"
  required_providers {
    google = { source = "hashicorp/google", version = "~> 7.0" }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

# Este bucket y su estado se conservan durante cada reconstrucción de app.
# En el primer uso se importa el bucket existente con `terraform import`.
resource "google_storage_bucket" "terraform_state" {
  name                        = var.state_bucket
  project                     = var.project_id
  location                    = "US-CENTRAL1"
  uniform_bucket_level_access = true
  force_destroy               = false
  versioning { enabled = true }
  lifecycle { prevent_destroy = true }
}

resource "google_storage_bucket" "velero" {
  name                        = var.velero_bucket
  project                     = var.project_id
  location                    = "US-CENTRAL1"
  uniform_bucket_level_access = true
  force_destroy               = false
  versioning { enabled = true }
  lifecycle_rule {
    condition { age = var.backup_retention_days }
    action { type = "Delete" }
  }
  lifecycle { prevent_destroy = true }
}

resource "google_service_account" "velero" {
  account_id   = "velero-p9"
  display_name = "Velero P9 backup access"
  project      = var.project_id
}

resource "google_storage_bucket_iam_member" "velero" {
  bucket = google_storage_bucket.velero.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.velero.email}"
}

# ArgoCD crea esta KSA desde GitOps; el vínculo puede existir antes.
resource "google_service_account_iam_member" "velero_workload_identity" {
  service_account_id = google_service_account.velero.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[velero/velero]"
}

resource "google_service_account_iam_member" "velero_token_creator" {
  service_account_id = google_service_account.velero.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:${google_service_account.velero.email}"
}
