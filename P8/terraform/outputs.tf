output "argocd_namespace" { value = kubernetes_namespace_v1.argocd.metadata[0].name }
output "application_namespace" { value = kubernetes_namespace_v1.application.metadata[0].name }
