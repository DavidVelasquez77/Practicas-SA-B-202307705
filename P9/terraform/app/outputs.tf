output "cluster_name" { value = google_container_cluster.comicrent.name }
output "argocd_application" { value = "comicrent-p9" }
output "argocd_namespace" { value = kubernetes_namespace_v1.argocd.metadata[0].name }
