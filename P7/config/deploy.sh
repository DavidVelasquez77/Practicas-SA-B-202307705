#!/usr/bin/env bash
set -euo pipefail
: "${RELEASE_TAG:?Falta RELEASE_TAG}"
: "${COMMIT_SHA:?Falta COMMIT_SHA}"
[[ "$RELEASE_TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || exit 1
ns=sa-p6
chart=P5/helm/comicrent

# Este CD utiliza exclusivamente la instalación existente de P6.
helm status comicrent -n "$ns" >/dev/null
kubectl get nodes -l cloud.google.com/gke-nodepool=default-pool -o json |
  jq -e 'any(.items[]; any(.status.conditions[]; .type == "Ready" and .status == "True"))' >/dev/null || {
    echo 'El usuario debe subir default-pool a 1 nodo y esperar Ready antes del CD.'; exit 1;
  }
for secret in comicrent-database-secret comicrent-rabbitmq-secret comicrent-auth-secret; do
  kubectl get secret "$secret" -n "$ns" -o name
done

# Conserva imagen y StorageClass reales del RabbitMQ existente.
rabbit_image=$(kubectl get statefulset comicrent-rabbitmq -n "$ns" -o jsonpath='{.spec.template.spec.containers[0].image}')
rabbit_repo=${rabbit_image%:*}
rabbit_tag=${rabbit_image##*:}
[[ -n "$rabbit_repo" && "$rabbit_repo" != "$rabbit_image" && "$rabbit_image" != *@* ]] || {
  echo 'Revisar la referencia actual de RabbitMQ antes de desplegar'; exit 1;
}
storage_class=$(kubectl get pvc data-comicrent-rabbitmq-0 -n "$ns" -o jsonpath='{.spec.storageClassName}')
test -n "$storage_class"
dns_ip=$(kubectl get service kube-dns -n kube-system -o jsonpath='{.spec.clusterIP}')
[[ "$dns_ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]
sed "s/<KUBE_DNS_CLUSTER_IP>/$dns_ip/g" P6/k8s/network-policies-gke.yaml | kubectl apply -f -

args=(-f P6/k8s/values-gke-prod.yaml -f P7/config/values-ci-cd.yaml
  --set-string "rabbitmq.image.registry="
  --set-string "rabbitmq.image.repository=$rabbit_repo"
  --set-string "rabbitmq.image.tag=$rabbit_tag"
  --set-string "rabbitmq.persistence.storageClass=$storage_class")
for service in api-gateway auth-service comics-service rentals-service copies-service copies-consumer operations-jobs; do
  args+=(--set-string "$service.image.tag=$RELEASE_TAG")
  args+=(--set-string "$service.deploymentRevision=$COMMIT_SHA")
done
helm lint "$chart" "${args[@]}"
helm upgrade comicrent "$chart" -n "$ns" "${args[@]}" --atomic --wait --timeout 15m --history-max 5

for service in api-gateway auth-service comics-service rentals-service copies-service copies-consumer summary-consumer; do
  kubectl rollout status "deployment/comicrent-$service" -n "$ns" --timeout=5m
  deployed=$(kubectl get "deployment/comicrent-$service" -n "$ns" -o jsonpath='{.spec.template.spec.containers[0].image}')
  [[ "$deployed" == ghcr.io/davidvelasquez77/comicrent-*:"$RELEASE_TAG" ]] || {
    echo "Versión inesperada en $service"; exit 1;
  }
done
kubectl rollout status statefulset/comicrent-rabbitmq -n "$ns" --timeout=5m
kubectl get pods -n "$ns" -o wide
kubectl get cronjobs -n "$ns"
helm history comicrent -n "$ns" --max 5

gateway_ip=$(kubectl get service comicrent-api-gateway -n "$ns" -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
test -n "$gateway_ip"
curl --fail --silent --show-error --retry 12 --retry-delay 5 --retry-all-errors "http://$gateway_ip:3000/health"
