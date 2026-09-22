output "state_bucket" { value = google_storage_bucket.terraform_state.name }
output "velero_bucket" { value = google_storage_bucket.velero.name }
output "velero_service_account" { value = google_service_account.velero.email }
output "project_id" { value = var.project_id }
