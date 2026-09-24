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

resource "google_project_service" "secret_manager" {
  project            = var.project_id
  service            = "secretmanager.googleapis.com"
  disable_on_destroy = false
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

# Secret Manager conserva la llave fuera del clúster y del estado de Terraform.
# Los bytes se cargan como versiones con gcloud; Terraform administra metadatos e IAM.
resource "google_secret_manager_secret" "sealed_secrets_cert" {
  project   = var.project_id
  secret_id = "comicrent-p9-sealed-secrets-tls-crt"
  replication {
    auto {}
  }
  lifecycle { prevent_destroy = true }
  depends_on = [google_project_service.secret_manager]
}

resource "google_secret_manager_secret" "sealed_secrets_key" {
  project   = var.project_id
  secret_id = "comicrent-p9-sealed-secrets-tls-key"
  replication {
    auto {}
  }
  lifecycle { prevent_destroy = true }
  depends_on = [google_project_service.secret_manager]
}

resource "google_secret_manager_secret_iam_member" "sealed_secrets_cert_accessor" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.sealed_secrets_cert.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = var.secret_accessor_member
}

resource "google_secret_manager_secret_iam_member" "sealed_secrets_key_accessor" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.sealed_secrets_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = var.secret_accessor_member
}

resource "google_secret_manager_secret_iam_member" "sealed_secrets_cert_version_adder" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.sealed_secrets_cert.secret_id
  role      = "roles/secretmanager.secretVersionAdder"
  member    = var.secret_accessor_member
}

resource "google_secret_manager_secret_iam_member" "sealed_secrets_key_version_adder" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.sealed_secrets_key.secret_id
  role      = "roles/secretmanager.secretVersionAdder"
  member    = var.secret_accessor_member
}
