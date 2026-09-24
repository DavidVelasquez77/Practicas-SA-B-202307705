terraform {
  backend "gcs" {
    bucket = "comicrent-p9-tf-2026-202307705"
    prefix = "p9/app"
  }
  required_version = ">= 1.6.0"
  required_providers {
    google     = { source = "hashicorp/google", version = "~> 7.0" }
    kubernetes = { source = "hashicorp/kubernetes", version = "~> 2.32" }
    helm       = { source = "hashicorp/helm", version = "~> 3.2" }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

data "google_client_config" "current" {}
data "terraform_remote_state" "seed" {
  backend = "gcs"
  config = {
    bucket = var.state_bucket
    prefix = "p9/seed"
  }
}

# La llave vive en Secret Manager (estado seed); Terraform app no depende de
# que el operador tenga una copia local en el equipo que ejecuta el bootstrap.
data "google_secret_manager_secret_version" "sealed_secrets_cert" {
  secret = data.terraform_remote_state.seed.outputs.sealed_secrets_cert_secret
}
data "google_secret_manager_secret_version" "sealed_secrets_key" {
  secret = data.terraform_remote_state.seed.outputs.sealed_secrets_key_secret
}

resource "google_project_service" "container" {
  project            = var.project_id
  service            = "container.googleapis.com"
  disable_on_destroy = false
}

resource "google_container_cluster" "comicrent" {
  name                     = var.cluster_name
  location                 = var.zone
  project                  = var.project_id
  network                  = var.network
  subnetwork               = var.subnetwork
  remove_default_node_pool = true
  initial_node_count       = 1
  deletion_protection      = false
  release_channel { channel = "REGULAR" }
  ip_allocation_policy {}
  workload_identity_config { workload_pool = "${var.project_id}.svc.id.goog" }
  master_authorized_networks_config {
    cidr_blocks {
      cidr_block   = var.master_authorized_cidr
      display_name = "operator"
    }
  }
  resource_labels = { application = "comicrent", practice = "p9", managed-by = "terraform" }
  lifecycle { ignore_changes = [initial_node_count] }
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
    metadata     = { disable-legacy-endpoints = "true" }
    oauth_scopes = ["https://www.googleapis.com/auth/cloud-platform"]
    workload_metadata_config { mode = "GKE_METADATA" }
    labels = { application = "comicrent", practice = "p9" }
  }
  management {
    auto_repair  = true
    auto_upgrade = true
  }
}

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

# Bootstrap mínimo: ArgoCD es el único chart instalado por Terraform.
resource "kubernetes_namespace_v1" "argocd" {
  metadata {
    name   = "argocd"
    labels = { "app.kubernetes.io/part-of" = "argocd" }
  }
  lifecycle { ignore_changes = [metadata[0].labels, metadata[0].annotations] }
  depends_on = [google_container_node_pool.primary]
}

# La fuente persistente es Secret Manager. El recurso Kubernetes Secret conserva
# su contenido sensible en el estado remoto GCS de app, que debe tener IAM limitado.
resource "kubernetes_secret_v1" "sealed_secrets_key" {
  metadata {
    name      = "sealed-secrets-key-p8"
    namespace = "kube-system"
    labels    = { "sealedsecrets.bitnami.com/sealed-secrets-key" = "active" }
  }
  type = "kubernetes.io/tls"
  data = {
    "tls.crt" = data.google_secret_manager_secret_version.sealed_secrets_cert.secret_data
    "tls.key" = data.google_secret_manager_secret_version.sealed_secrets_key.secret_data
  }
  depends_on = [google_container_node_pool.primary]
}

resource "helm_release" "argocd" {
  name            = "argocd"
  namespace       = kubernetes_namespace_v1.argocd.metadata[0].name
  repository      = "https://argoproj.github.io/argo-helm"
  chart           = "argo-cd"
  version         = "10.9.1"
  atomic          = true
  cleanup_on_fail = true
  timeout         = 600
  values = [yamlencode({
    applicationSet = { replicas = 1 }
    notifications  = { enabled = false }
    configs        = { params = { "server.insecure" = true } }
  })]
  depends_on = [kubernetes_namespace_v1.argocd]
}

resource "helm_release" "argocd_root" {
  name                       = "p9-argocd-bootstrap"
  namespace                  = kubernetes_namespace_v1.argocd.metadata[0].name
  chart                      = "${path.module}/bootstrap"
  atomic                     = true
  cleanup_on_fail            = true
  disable_openapi_validation = true
  take_ownership             = true
  timeout                    = 600
  values = [yamlencode({
    gitops = {
      repoURL        = var.gitops_repo
      targetRevision = var.gitops_revision
      path           = "apps/p9"
    }
    seed = {
      project              = var.project_id
      veleroBucket         = data.terraform_remote_state.seed.outputs.velero_bucket
      veleroServiceAccount = data.terraform_remote_state.seed.outputs.velero_service_account
    }
  })]
  depends_on = [helm_release.argocd, kubernetes_secret_v1.sealed_secrets_key]
}
