output "state_bucket" { value = google_storage_bucket.terraform_state.name }
output "velero_bucket" { value = google_storage_bucket.velero.name }
output "velero_service_account" { value = google_service_account.velero.email }
output "project_id" { value = var.project_id }
output "sealed_secrets_cert_secret" { value = google_secret_manager_secret.sealed_secrets_cert.secret_id }
output "sealed_secrets_key_secret" { value = google_secret_manager_secret.sealed_secrets_key.secret_id }
