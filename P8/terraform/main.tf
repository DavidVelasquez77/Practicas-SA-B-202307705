terraform {
  backend "gcs" {
    bucket = "comicrent-p9-tf-2026-202307705"
    prefix = "comicrent-platform"
  }

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
    google = {
      source  = "hashicorp/google"
      version = "~> 7.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

data "google_client_config" "current" {}

provider "kubernetes" {
  host                   = "https://${google_container_cluster.comicrent.endpoint}"
  token                  = data.google_client_config.current.access_token
  cluster_ca_certificate = base64decode(google_container_cluster.comicrent.master_auth[0].cluster_ca_certificate)
}

provider "helm" {
  kubernetes = {
    host                   = "https://${google_container_cluster.comicrent.endpoint}"
    token                  = data.google_client_config.current.access_token
    cluster_ca_certificate = base64decode(google_container_cluster.comicrent.master_auth[0].cluster_ca_certificate)
  }
}

resource "google_project_service" "container" {
  project            = var.project_id
  service            = "container.googleapis.com"
  disable_on_destroy = false
}

resource "google_container_cluster" "comicrent" {
  name     = var.cluster_name
  location = var.zone
  project  = var.project_id

  network    = var.network
  subnetwork = var.subnetwork

  remove_default_node_pool = true
  initial_node_count       = 1
  deletion_protection      = false

  release_channel {
    channel = "REGULAR"
  }

  ip_allocation_policy {}

  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  master_authorized_networks_config {
    cidr_blocks {
      cidr_block   = var.master_authorized_cidr
      display_name = "operator"
    }
  }

  resource_labels = {
    application = "comicrent"
    practice    = "p8"
    managed-by  = "terraform"
  }

  # Al adoptar un clúster que ya eliminó su pool inicial, GKE reporta 0.
  # En una creación nueva Terraform sigue usando 1 y lo elimina de inmediato.
  lifecycle {
    ignore_changes = [initial_node_count]
  }

  depends_on = [google_project_service.container]
}

resource "google_container_node_pool" "primary" {
  name       = var.node_pool_name
  project    = var.project_id
  location   = var.zone
  cluster    = google_container_cluster.comicrent.name
  node_count = var.node_count

  node_config {
    machine_type = var.machine_type
    disk_type    = "pd-balanced"
    disk_size_gb = 20

    metadata = {
      disable-legacy-endpoints = "true"
    }

    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]

    workload_metadata_config {
      mode = "GKE_METADATA"
    }

    labels = {
      application = "comicrent"
      practice    = "p8"
    }
  }

  management {
    auto_repair  = true
    auto_upgrade = true
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

resource "kubernetes_namespace_v1" "application_p9" {
  metadata {
    name   = "sa-p9"
    labels = { "app.kubernetes.io/part-of" = "comicrent-p9" }
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

  depends_on = [google_container_node_pool.primary]
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

  depends_on = [google_container_node_pool.primary]
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

  depends_on = [google_container_node_pool.primary]
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

  depends_on = [kubernetes_secret_v1.sealed_secrets_key]
}

# La clave de recuperación permanece fuera de Git. Esto permite destruir y
# reconstruir el clúster sin invalidar los SealedSecret del repositorio GitOps.
resource "kubernetes_secret_v1" "sealed_secrets_key" {
  metadata {
    name      = "sealed-secrets-key-p8"
    namespace = "kube-system"
    labels = {
      "sealedsecrets.bitnami.com/sealed-secrets-key" = "active"
    }
  }

  type = "kubernetes.io/tls"
  data = {
    "tls.crt" = file(pathexpand(var.sealed_secrets_cert_path))
    "tls.key" = file(pathexpand(var.sealed_secrets_key_path))
  }

  depends_on = [google_container_node_pool.primary]
}

# Bootstrap declarativo: Terraform instala políticas, AppProject y la única
# Application. Desde ese punto ArgoCD es quien aplica exclusivamente la app.
resource "helm_release" "platform_bootstrap" {
  name      = "p8-platform-bootstrap"
  namespace = kubernetes_namespace_v1.argocd.metadata[0].name
  chart     = "${path.module}/bootstrap"

  atomic                     = true
  cleanup_on_fail            = true
  disable_openapi_validation = true
  take_ownership             = true
  timeout                    = 600

  values = [yamlencode({
    p9 = {
      enabled = true
      gitops = {
        repoURL        = "https://github.com/DavidVelasquez77/Practicas-SA-B-202307705-gitops.git"
        targetRevision = "p9-continuidad-operativa"
        path           = "apps/p9"
      }
      application = {
        name      = "comicrent-p9"
        namespace = "sa-p9"
      }
    }
  })]

  depends_on = [
    helm_release.argocd,
    helm_release.argo_rollouts,
    helm_release.kyverno,
    helm_release.sealed_secrets,
    kubernetes_resource_quota_v1.application,
    kubernetes_limit_range_v1.application,
    kubernetes_namespace_v1.application_p9,
    kubernetes_resource_quota_v1.application_p9,
    kubernetes_limit_range_v1.application_p9,
  ]
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

resource "kubernetes_resource_quota_v1" "application_p9" {
  metadata {
    name      = "comicrent-p9-quota"
    namespace = kubernetes_namespace_v1.application_p9.metadata[0].name
  }
  spec {
    hard = {
      "requests.cpu"     = "4"
      "requests.memory"  = "6Gi"
      "limits.cpu"       = "8"
      "limits.memory"    = "12Gi"
      pods               = "30"
      "requests.storage" = "10Gi"
    }
  }
  lifecycle {
    ignore_changes = [metadata[0].labels, metadata[0].annotations]
  }
}

resource "kubernetes_limit_range_v1" "application_p9" {
  metadata {
    name      = "comicrent-p9-limits"
    namespace = kubernetes_namespace_v1.application_p9.metadata[0].name
  }
  spec {
    limit {
      type            = "Container"
      default         = { cpu = "500m", memory = "512Mi" }
      default_request = { cpu = "50m", memory = "64Mi" }
      min             = { cpu = "10m", memory = "32Mi" }
      max             = { cpu = "1", memory = "1Gi" }
    }
  }
  lifecycle {
    ignore_changes = [metadata[0].labels, metadata[0].annotations]
  }
}

# P9: backups are stored outside the cluster and accessed with Workload Identity.
resource "google_storage_bucket" "velero" {
  name                        = "comicrent-p9-velero-2026-202307705"
  project                     = var.project_id
  location                    = "US-CENTRAL1"
  uniform_bucket_level_access = true
  force_destroy               = false

  versioning { enabled = true }

  lifecycle_rule {
    condition { age = 30 }
    action { type = "Delete" }
  }
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

resource "kubernetes_namespace_v1" "velero" {
  metadata {
    name = "velero"
    labels = {
      "pod-security.kubernetes.io/enforce" = "privileged"
      "pod-security.kubernetes.io/audit"   = "privileged"
      "pod-security.kubernetes.io/warn"    = "privileged"
    }
  }
}

resource "kubernetes_service_account_v1" "velero" {
  metadata {
    name      = "velero"
    namespace = kubernetes_namespace_v1.velero.metadata[0].name
    annotations = {
      "iam.gke.io/gcp-service-account" = google_service_account.velero.email
    }
  }
  depends_on = [google_service_account_iam_member.velero_workload_identity]
}

resource "helm_release" "velero" {
  name       = "velero"
  namespace  = kubernetes_namespace_v1.velero.metadata[0].name
  repository = "https://vmware-tanzu.github.io/helm-charts"
  chart      = "velero"
  version    = "8.0.0"
  atomic     = true
  timeout    = 900

  values = [yamlencode({
    serviceAccount = {
      server = {
        create = false
        name   = kubernetes_service_account_v1.velero.metadata[0].name
      }
    }
    credentials = { useSecret = false }
    initContainers = [{
      name         = "velero-plugin-for-gcp"
      image        = "velero/velero-plugin-for-gcp:v1.10.0"
      volumeMounts = [{ mountPath = "/target", name = "plugins" }]
    }]
    configuration = {
      backupStorageLocation = [{
        name       = "default"
        provider   = "gcp"
        bucket     = google_storage_bucket.velero.name
        default    = true
        accessMode = "ReadWrite"
        config     = { serviceAccount = google_service_account.velero.email }
      }]
      defaultBackupStorageLocation = "default"
      defaultBackupTTL             = "168h"
      features                     = "EnableCSI"
    }
    snapshotsEnabled         = false
    deployNodeAgent          = true
    defaultVolumesToFsBackup = true
    upgradeCRDs              = false
    extraObjects = [{
      apiVersion = "velero.io/v1"
      kind       = "Schedule"
      metadata = {
        name      = "comicrent-p9-daily"
        namespace = "velero"
      }
      spec = {
        schedule = "0 */6 * * *"
        template = {
          ttl                      = "168h"
          includedNamespaces       = ["sa-p8", "sa-p9", "argocd", "argo-rollouts", "kube-system"]
          includeClusterResources  = true
          defaultVolumesToFsBackup = true
          storageLocation          = "default"
        }
      }
    }]
  })]

  depends_on = [
    kubernetes_service_account_v1.velero,
    google_storage_bucket_iam_member.velero,
    google_service_account_iam_member.velero_token_creator,
  ]
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


