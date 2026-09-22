[CmdletBinding()]
param([string]$Namespace = "sa-p9")
$ErrorActionPreference = "Stop"
kubectl get application comicrent-p9 -n argocd
kubectl get application comicrent-p9-workloads -n argocd
kubectl get pods -n $Namespace -o wide
kubectl get pvc -n $Namespace
kubectl get pdb -n $Namespace
kubectl get backupstoragelocation,schedule -n velero
kubectl get rollout comicrent-api-gateway-rollout -n $Namespace -o wide
