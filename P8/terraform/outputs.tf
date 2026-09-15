output "argocd_namespace" { value = kubernetes_namespace_v1.argocd.metadata[0].name }
output "application_namespace" { value = kubernetes_namespace_v1.application.metadata[0].name }
output "cluster_name" { value = google_container_cluster.comicrent.name }
output "cluster_location" { value = google_container_cluster.comicrent.location }
output "argocd_application" { value = "comicrent-p8" }
