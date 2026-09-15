terraform {
  required_version = ">= 1.6.0"
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.32"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 3.2"
    }
  }
}

provider "kubernetes" {
  config_path = var.kubeconfig
}

provider "helm" {
  kubernetes = {
    config_path = var.kubeconfig
  }
}

resource "kubernetes_namespace_v1" "argocd" {
  metadata {
    name   = "argocd"
    labels = { "app.kubernetes.io/part-of" = "argocd" }
  }

  # ArgoCD/Helm añade etiquetas de identificación al namespace existente.
  lifecycle {
    ignore_changes = [metadata[0].labels, metadata[0].annotations]
  }
}

resource "kubernetes_namespace_v1" "application" {
  metadata {
    name   = var.application_namespace
    labels = { "app.kubernetes.io/part-of" = "comicrent" }
  }

  lifecycle {
    ignore_changes = [metadata[0].labels, metadata[0].annotations]
  }
}

resource "kubernetes_namespace_v1" "argo_rollouts" {
  metadata {
    name   = "argo-rollouts"
    labels = { "app.kubernetes.io/part-of" = "argo-rollouts" }
  }

  lifecycle {
    ignore_changes = [metadata[0].labels, metadata[0].annotations]
  }
}

resource "kubernetes_namespace_v1" "kyverno" {
  metadata {
    name   = "kyverno"
    labels = { "app.kubernetes.io/part-of" = "kyverno" }
  }

  lifecycle {
    ignore_changes = [metadata[0].labels, metadata[0].annotations]
  }
}

resource "helm_release" "argocd" {
  name       = "argocd"
  namespace  = kubernetes_namespace_v1.argocd.metadata[0].name
  repository = "https://argoproj.github.io/argo-helm"
  chart      = "argo-cd"
  version    = "10.9.1"

  atomic          = true
  cleanup_on_fail = true
  timeout         = 600

  values = [yamlencode({
    applicationSet = { replicas = 1 }
    notifications  = { enabled = false }
    configs = {
      params = { "server.insecure" = true }
    }
  })]
}

resource "helm_release" "argo_rollouts" {
  name       = "argo-rollouts"
  namespace  = kubernetes_namespace_v1.argo_rollouts.metadata[0].name
  repository = "https://argoproj.github.io/argo-helm"
  chart      = "argo-rollouts"
  version    = "2.43.1"

  atomic          = true
  cleanup_on_fail = true
  timeout         = 600
}

resource "helm_release" "kyverno" {
  name       = "kyverno"
  namespace  = kubernetes_namespace_v1.kyverno.metadata[0].name
  repository = "https://kyverno.github.io/kyverno"
  chart      = "kyverno"
  version    = "3.9.1"

  atomic          = true
  cleanup_on_fail = true
  timeout         = 900

  values = [yamlencode({
    admissionController  = { replicas = 1 }
    backgroundController = { replicas = 1 }
    cleanupController    = { replicas = 1 }
    reportsController    = { replicas = 1 }
  })]
}

resource "helm_release" "sealed_secrets" {
  name       = "sealed-secrets"
  namespace  = "kube-system"
  repository = "https://charts.bitnami.com/bitnami"
  chart      = "sealed-secrets"
  version    = "2.5.19"

  atomic          = true
  cleanup_on_fail = true
  timeout         = 600

  values = [yamlencode({
    fullnameOverride = "sealed-secrets-controller"
  })]
}

resource "kubernetes_resource_quota_v1" "application" {
  metadata {
    name      = "comicrent-quota"
    namespace = kubernetes_namespace_v1.application.metadata[0].name
  }
  spec {
    hard = {
      "requests.cpu"         = "2"
      "requests.memory"      = "2Gi"
      "limits.cpu"           = "4"
      "limits.memory"        = "4Gi"
      pods                   = "20"
      "requests.storage"     = "10Gi"
      persistentvolumeclaims = "5"
      services               = "15"
      configmaps             = "20"
      secrets                = "15"
    }
  }

  lifecycle {
    ignore_changes = [metadata[0].labels, metadata[0].annotations]
  }
}

resource "kubernetes_limit_range_v1" "application" {
  metadata {
    name      = "comicrent-limits"
    namespace = kubernetes_namespace_v1.application.metadata[0].name
  }
  spec {
    limit {
      type = "Container"
      default = {
        cpu    = "500m"
        memory = "512Mi"
      }
      default_request = {
        cpu    = "50m"
        memory = "64Mi"
      }
      min = {
        cpu    = "10m"
        memory = "32Mi"
      }
      max = {
        cpu    = "1"
        memory = "1Gi"
      }
    }
  }

  lifecycle {
    ignore_changes = [metadata[0].labels, metadata[0].annotations]
  }
}

resource "kubernetes_role_v1" "rollout_reader" {
  metadata {
    name      = "rollout-reader"
    namespace = kubernetes_namespace_v1.application.metadata[0].name
  }
  rule {
    api_groups = ["argoproj.io"]
    resources  = ["rollouts", "analysistemplates"]
    verbs      = ["get", "list", "watch"]
  }
}

resource "kubernetes_role_binding_v1" "rollout_reader" {
  metadata {
    name      = "rollout-reader"
    namespace = kubernetes_namespace_v1.application.metadata[0].name
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role_v1.rollout_reader.metadata[0].name
  }
  subject {
    kind      = "ServiceAccount"
    name      = var.analysis_service_account
    namespace = kubernetes_namespace_v1.application.metadata[0].name
  }
}

resource "kubernetes_cluster_role_v1" "argocd_application_reader" {
  metadata {
    name = "comicrent-argocd-application-reader"
  }
  rule {
    api_groups = ["", "apps", "argoproj.io"]
    resources  = ["namespaces", "services", "deployments", "rollouts", "pods", "analysistemplates"]
    verbs      = ["get", "list", "watch"]
  }
}

resource "kubernetes_cluster_role_binding_v1" "argocd_application_reader" {
  metadata {
    name = "comicrent-argocd-application-reader"
  }
  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = kubernetes_cluster_role_v1.argocd_application_reader.metadata[0].name
  }
  subject {
    kind      = "ServiceAccount"
    name      = "argocd-server"
    namespace = kubernetes_namespace_v1.argocd.metadata[0].name
  }
}
