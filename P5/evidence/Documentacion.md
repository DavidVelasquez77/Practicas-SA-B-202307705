PS C:\Users\Vela\Desktop\SA\LAB\PRACTICAS\P5\helm\comicrent> kubectl get all -n sa-p5
NAME                                              READY   STATUS      RESTARTS   AGE
pod/comicrent-api-gateway-6485d6cdd4-fz4m8        1/1     Running     0          53m
pod/comicrent-auth-service-5dffc876fd-q2bfp       1/1     Running     0          98m
pod/comicrent-comics-service-6fdf6c8957-t2hkp     1/1     Running     0          150m
pod/comicrent-copies-consumer-67bc59bc77-8w572    1/1     Running     0          36m
pod/comicrent-copies-service-984f97c77-ctk2w      1/1     Running     0          150m
pod/comicrent-cron-summary-manual-bwx6l           0/1     Completed   0          4m18s
pod/comicrent-cron-tick-29793944-w4qbn            0/1     Completed   0          3m45s
pod/comicrent-cron-tick-29793946-7h9tn            0/1     Completed   0          105s
pod/comicrent-cron-tick-manual-8h4k7              0/1     Completed   0          4m52s
pod/comicrent-postgresql-0                        1/1     Running     0          34m
pod/comicrent-rabbitmq-0                          1/1     Running     0          129m
pod/comicrent-rentals-service-dd598646-hnnhv      1/1     Running     0          48m
pod/comicrent-summary-consumer-6894ddff77-9xqp2   1/1     Running     0          7m27s

NAME                                  TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)                                 AGE
service/comicrent-api-gateway         ClusterIP   10.108.108.11   <none>        3000/TCP                                176m
service/comicrent-auth-service        ClusterIP   10.101.121.92   <none>        3001/TCP                                176m
service/comicrent-comics-service      ClusterIP   10.96.31.104    <none>        3002/TCP                                176m
service/comicrent-copies-service      ClusterIP   10.97.8.49      <none>        8002/TCP                                176m
service/comicrent-postgresql          ClusterIP   10.111.8.188    <none>        5432/TCP                                176m
service/comicrent-postgresql-hl       ClusterIP   None            <none>        5432/TCP                                176m
service/comicrent-rabbitmq            ClusterIP   10.108.94.34    <none>        5672/TCP,4369/TCP,25672/TCP,15672/TCP   176m
service/comicrent-rabbitmq-headless   ClusterIP   None            <none>        4369/TCP,5672/TCP,25672/TCP,15672/TCP   176m
service/comicrent-rentals-service     ClusterIP   10.110.158.34   <none>        8001/TCP                                176m

NAME                                         READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/comicrent-api-gateway        1/1     1            1           176m
deployment.apps/comicrent-auth-service       1/1     1            1           176m
deployment.apps/comicrent-comics-service     1/1     1            1           176m
deployment.apps/comicrent-copies-consumer    1/1     1            1           168m
deployment.apps/comicrent-copies-service     1/1     1            1           176m
deployment.apps/comicrent-rentals-service    1/1     1            1           168m
deployment.apps/comicrent-summary-consumer   1/1     1            1           7m27s

NAME                                                    DESIRED   CURRENT   READY   AGE
replicaset.apps/comicrent-api-gateway-5c47cf7479        0         0         0       176m
replicaset.apps/comicrent-api-gateway-6485d6cdd4        1         1         1       53m
replicaset.apps/comicrent-api-gateway-79966d6f9f        0         0         0       150m
replicaset.apps/comicrent-auth-service-5dffc876fd       1         1         1       98m
replicaset.apps/comicrent-auth-service-754d896d84       0         0         0       150m
replicaset.apps/comicrent-auth-service-7f57cbc8c4       0         0         0       176m
replicaset.apps/comicrent-comics-service-6fdf6c8957     1         1         1       150m
replicaset.apps/comicrent-comics-service-78fdb4b757     0         0         0       176m
replicaset.apps/comicrent-copies-consumer-67bc59bc77    1         1         1       150m
replicaset.apps/comicrent-copies-consumer-699854645     0         0         0       168m
replicaset.apps/comicrent-copies-service-7dfc5d45cc     0         0         0       176m
replicaset.apps/comicrent-copies-service-984f97c77      1         1         1       150m
replicaset.apps/comicrent-rentals-service-67b859b87f    0         0         0       168m
replicaset.apps/comicrent-rentals-service-869ffcc879    0         0         0       150m
replicaset.apps/comicrent-rentals-service-dd598646      1         1         1       48m
replicaset.apps/comicrent-summary-consumer-6894ddff77   1         1         1       7m27s

NAME                                    READY   AGE
statefulset.apps/comicrent-postgresql   1/1     176m
statefulset.apps/comicrent-rabbitmq     1/1     176m

NAME                                                        REFERENCE                          TARGETS       MINPODS   MAXPODS   REPLICAS   AGE
horizontalpodautoscaler.autoscaling/comicrent-api-gateway   Deployment/comicrent-api-gateway   cpu: 1%/40%   1         2         1          176m

NAME                                   SCHEDULE       TIMEZONE   SUSPEND   ACTIVE   LAST SCHEDULE   AGE
cronjob.batch/comicrent-cron-summary   */10 * * * *   <none>     False     0        <none>          7m27s
cronjob.batch/comicrent-cron-tick      */2 * * * *    <none>     False     0        105s            7m27s

NAME                                      STATUS     COMPLETIONS   DURATION   AGE
job.batch/comicrent-cron-summary-manual   Complete   1/1           15s        4m18s
job.batch/comicrent-cron-tick-29793944    Complete   1/1           14s        3m45s
job.batch/comicrent-cron-tick-29793946    Complete   1/1           12s        105s
job.batch/comicrent-cron-tick-manual      Complete   1/1           14s        4m52s

PS C:\Users\Vela\Desktop\SA\LAB\PRACTICAS\P5\helm\comicrent> kubectl get cronjobs,jobs -n sa-p5
NAME                                   SCHEDULE       TIMEZONE   SUSPEND   ACTIVE   LAST SCHEDULE   AGE
cronjob.batch/comicrent-cron-summary   */10 * * * *   <none>     False     0        <none>          8m45s
cronjob.batch/comicrent-cron-tick      */2 * * * *    <none>     False     0        63s             8m45s

NAME                                      STATUS     COMPLETIONS   DURATION   AGE
job.batch/comicrent-cron-summary-manual   Complete   1/1           15s        5m36s
job.batch/comicrent-cron-tick-29793944    Complete   1/1           14s        5m3s
job.batch/comicrent-cron-tick-29793946    Complete   1/1           12s        3m3s
job.batch/comicrent-cron-tick-29793948    Complete   1/1           14s        63s
PS C:\Users\Vela\Desktop\SA\LAB\PRACTICAS\P5\helm\comicrent> kubectl get pvc -n sa-p5
NAME                          STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS   VOLUMEATTRIBUTESCLASS   AGE
data-comicrent-postgresql-0   Bound    pvc-d6ef4e11-6f0c-4057-afcc-92286daf1378   2Gi        RWO            standard       <unset>                 178m
data-comicrent-rabbitmq-0     Bound    pvc-d037512a-396c-4e8f-b2cf-a29d0002dcaa   1Gi        RWO            standard       <unset>                 178m
PS C:\Users\Vela\Desktop\SA\LAB\PRACTICAS\P5\helm\comicrent> kubectl get networkpolicy -n sa-p5
NAME                        POD-SELECTOR                                                                                                 AGE
comicrent-allow-dns         <none>                                                                                                       178m
comicrent-api-gateway       app.kubernetes.io/instance=comicrent,app.kubernetes.io/name=api-gateway                                      178m
comicrent-auth-service      app.kubernetes.io/instance=comicrent,app.kubernetes.io/name=auth-service                                     178m
comicrent-comics-service    app.kubernetes.io/instance=comicrent,app.kubernetes.io/name=comics-service                                   178m
comicrent-copies-consumer   app.kubernetes.io/instance=comicrent,app.kubernetes.io/name=copies-consumer                                  178m
comicrent-copies-service    app.kubernetes.io/instance=comicrent,app.kubernetes.io/name=copies-service                                   178m
comicrent-cron-summary      app.kubernetes.io/name=cron-summary                                                                          8m53s
comicrent-cron-tick         app.kubernetes.io/name=cron-tick                                                                             8m53s
comicrent-default-deny      <none>                                                                                                       178m
comicrent-postgresql        app.kubernetes.io/component=primary,app.kubernetes.io/instance=comicrent,app.kubernetes.io/name=postgresql   178m
comicrent-rabbitmq          app.kubernetes.io/instance=comicrent,app.kubernetes.io/name=rabbitmq                                         178m
comicrent-rentals-service   app.kubernetes.io/instance=comicrent,app.kubernetes.io/name=rentals-service                                  178m
PS C:\Users\Vela\Desktop\SA\LAB\PRACTICAS\P5\helm\comicrent> helm history comicrent
REVISION        UPDATED                         STATUS          CHART           APP VERSION     DESCRIPTION                                   
1               Mon Aug 24 20:50:53 2026        failed          comicrent-0.1.0 1.0.0           Release "comicrent" failed: server-side apply failed for object sa-p5/comicrent-copies-consumer apps/v1, Kind=Deployment: failed to create typed patch object (sa-p5/comicrent-copies-consumer; apps/v1, Kind=Deployment): .spec.template.annotations: field not declared in sch...
2               Mon Aug 24 20:59:19 2026        failed          comicrent-0.1.0 1.0.0           Upgrade "comicrent" failed: context canceled                                   
3               Mon Aug 24 21:17:41 2026        superseded      comicrent-0.1.0 1.0.0           Upgrade "comicrent" failed: resource Deployment/sa-p5/comicrent-auth-service not ready. status: Failed, message: Progress deadline exceeded                                   
                                                                                                resource Deployment/sa-p5/comicrent-copies-consumer not ready. status: InProgress, message: Available: 0/1                                   
                                                                                                resource StatefulSet/sa-p5/...                                   
4               Mon Aug 24 22:09:30 2026        superseded      comicrent-0.1.0 1.0.0           Upgrade complete                                   
5               Mon Aug 24 22:54:40 2026        superseded      comicrent-0.1.0 1.0.0           Upgrade complete                                   
6               Mon Aug 24 22:58:50 2026        superseded      comicrent-0.1.0 1.0.0           Upgrade complete                                   
7               Mon Aug 24 23:40:15 2026        deployed        comicrent-0.1.0 1.0.0           Upgrade complete                                                                                                                       

















-



-----------------------------------------------
PS C:\Users\Vela\Desktop\SA\LAB\PRACTICAS\P5\helm\comicrent> kubectl get cronjobs,jobs -n sa-p5
NAME                                   SCHEDULE       TIMEZONE   SUSPEND   ACTIVE   LAST SCHEDULE   AGE
cronjob.batch/comicrent-cron-summary   */10 * * * *   <none>     False     0        <none>          8m45s
cronjob.batch/comicrent-cron-tick      */2 * * * *    <none>     False     0        63s             8m45s

NAME                                      STATUS     COMPLETIONS   DURATION   AGE
job.batch/comicrent-cron-summary-manual   Complete   1/1           15s        5m36s
job.batch/comicrent-cron-tick-29793944    Complete   1/1           14s        5m3s
job.batch/comicrent-cron-tick-29793946    Complete   1/1           12s        3m3s
job.batch/comicrent-cron-tick-29793948    Complete   1/1           14s        63s
PS C:\Users\Vela\Desktop\SA\LAB\PRACTICAS\P5\helm\comicrent> kubectl get pvc -n sa-p5
NAME                          STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS   VOLUMEATTRIBUTESCLASS   AGE
data-comicrent-postgresql-0   Bound    pvc-d6ef4e11-6f0c-4057-afcc-92286daf1378   2Gi        RWO            standard       <unset>                 178m
data-comicrent-rabbitmq-0     Bound    pvc-d037512a-396c-4e8f-b2cf-a29d0002dcaa   1Gi        RWO            standard       <unset>                 178m
PS C:\Users\Vela\Desktop\SA\LAB\PRACTICAS\P5\helm\comicrent> kubectl get networkpolicy -n sa-p5
NAME                        POD-SELECTOR                                                                                                 AGE
comicrent-allow-dns         <none>                                                                                                       178m
comicrent-api-gateway       app.kubernetes.io/instance=comicrent,app.kubernetes.io/name=api-gateway                                      178m
comicrent-auth-service      app.kubernetes.io/instance=comicrent,app.kubernetes.io/name=auth-service                                     178m
comicrent-comics-service    app.kubernetes.io/instance=comicrent,app.kubernetes.io/name=comics-service                                   178m
comicrent-copies-consumer   app.kubernetes.io/instance=comicrent,app.kubernetes.io/name=copies-consumer                                  178m
comicrent-copies-service    app.kubernetes.io/instance=comicrent,app.kubernetes.io/name=copies-service                                   178m
comicrent-cron-summary      app.kubernetes.io/name=cron-summary                                                                          8m53s
comicrent-cron-tick         app.kubernetes.io/name=cron-tick                                                                             8m53s
comicrent-default-deny      <none>                                                                                                       178m
comicrent-postgresql        app.kubernetes.io/component=primary,app.kubernetes.io/instance=comicrent,app.kubernetes.io/name=postgresql   178m
comicrent-rabbitmq          app.kubernetes.io/instance=comicrent,app.kubernetes.io/name=rabbitmq                                         178m
comicrent-rentals-service   app.kubernetes.io/instance=comicrent,app.kubernetes.io/name=rentals-service                                  178m
PS C:\Users\Vela\Desktop\SA\LAB\PRACTICAS\P5\helm\comicrent> helm history comicrent
REVISION        UPDATED                         STATUS          CHART           APP VERSION     DESCRIPTION                                                                                                                                                                                                                                                                        
1               Mon Aug 24 20:50:53 2026        failed          comicrent-0.1.0 1.0.0           Release "comicrent" failed: server-side apply failed for object sa-p5/comicrent-copies-consumer apps/v1, Kind=Deployment: failed to create typed patch object (sa-p5/comicrent-copies-consumer; apps/v1, Kind=Deployment): .spec.template.annotations: field not declared in sch...
2               Mon Aug 24 20:59:19 2026        failed          comicrent-0.1.0 1.0.0           Upgrade "comicrent" failed: context canceled                                                                                                                                                                                                                                       
3               Mon Aug 24 21:17:41 2026        superseded      comicrent-0.1.0 1.0.0           Upgrade "comicrent" failed: resource Deployment/sa-p5/comicrent-auth-service not ready. status: Failed, message: Progress deadline exceeded                                                                                                                                        
                                                                                                resource Deployment/sa-p5/comicrent-copies-consumer not ready. status: InProgress, message: Available: 0/1                                                                                                                                                                         
                                                                                                resource StatefulSet/sa-p5/...                                                                                                                                                                                                                                                     
4               Mon Aug 24 22:09:30 2026        superseded      comicrent-0.1.0 1.0.0           Upgrade complete                                                                                                                                                                                                                                                                   
5               Mon Aug 24 22:54:40 2026        superseded      comicrent-0.1.0 1.0.0           Upgrade complete                                                                                                                                                                                                                                                                   
6               Mon Aug 24 22:58:50 2026        superseded      comicrent-0.1.0 1.0.0           Upgrade complete                                                                                                                                                                                                                                                                   
7               Mon Aug 24 23:40:15 2026        deployed        comicrent-0.1.0 1.0.0           Upgrade complete                                                                                                                                                                                                                                                                   
PS C:\Users\Vela\Desktop\SA\LAB\PRACTICAS\P5\helm\comicrent> minikube delete
🔥  Eliminando "minikube" en docker...
🔥  Eliminando contenedor "minikube" ...
🔥  Eliminando C:\Users\Vela\.minikube\machines\minikube...
💀  Removed all traces of the "minikube" cluster.
PS C:\Users\Vela\Desktop\SA\LAB\PRACTICAS\P5\helm\comicrent> minikube start `
>>   --driver=docker `
>>   --cpus=4 `
>>   --memory=3500 `
>>   --cni=calico
😄  minikube v1.38.1 en Microsoft Windows 11 Pro 25H2
✨  Using the docker driver based on user configuration
❗  Starting v1.39.0, minikube will default to "containerd" container runtime. See #21973 for more info.
📌  Using Docker Desktop driver with root privileges
👍  Starting "minikube" primary control-plane node in "minikube" cluster
🚜  Pulling base image v0.0.50 ...
🔥  Creating docker container (CPUs=4, Memory=3500MB) ... 
🐳  Preparando Kubernetes v1.35.1 en Docker 29.2.1... 
🔗  Configurando CNI Calico ...
🔎  Verifying Kubernetes components...
    ▪ Using image gcr.io/k8s-minikube/storage-provisioner:v5
🌟  Complementos habilitados: storage-provisioner, default-storageclass
🏄  Done! kubectl is now configured to use "minikube" cluster and "default" namespace by default
PS C:\Users\Vela\Desktop\SA\LAB\PRACTICAS\P5\helm\comicrent> kubectl get nodes
NAME       STATUS   ROLES           AGE     VERSION
minikube   Ready    control-plane   2m13s   v1.35.1
PS C:\Users\Vela\Desktop\SA\LAB\PRACTICAS\P5\helm\comicrent> kubectl get pods -n kube-system
NAME                                       READY   STATUS    RESTARTS   AGE
calico-kube-controllers-565c89d6df-s9476   1/1     Running   0          2m9s
calico-node-klggn                          1/1     Running   0          2m9s
coredns-7d764666f9-b77b9                   1/1     Running   0          2m9s
etcd-minikube                              1/1     Running   0          2m14s
kube-apiserver-minikube                    1/1     Running   0          2m16s
kube-controller-manager-minikube           1/1     Running   0          2m14s
kube-proxy-6qzk9                           1/1     Running   0          2m9s
kube-scheduler-minikube                    1/1     Running   0          2m14s
storage-provisioner                        1/1     Running   0          2m12s
PS C:\Users\Vela\Desktop\SA\LAB\PRACTICAS\P5\helm\comicrent> minikube addons enable metrics-server
💡  metrics-server is an addon maintained by Kubernetes. For any concerns contact minikube on GitHub.
You can view the list of minikube maintainers at: https://github.com/kubernetes/minikube/blob/master/OWNERS
    ▪ Using image registry.k8s.io/metrics-server/metrics-server:v0.8.1
🌟  The 'metrics-server' addon is enabled
PS C:\Users\Vela\Desktop\SA\LAB\PRACTICAS\P5\helm\comicrent> kubectl get pods -n kube-system
NAME                                       READY   STATUS    RESTARTS   AGE
calico-kube-controllers-565c89d6df-s9476   1/1     Running   0          5m14s
calico-node-klggn                          1/1     Running   0          5m14s
coredns-7d764666f9-b77b9                   1/1     Running   0          5m14s
etcd-minikube                              1/1     Running   0          5m19s
kube-apiserver-minikube                    1/1     Running   0          5m21s
kube-controller-manager-minikube           1/1     Running   0          5m19s
kube-proxy-6qzk9                           1/1     Running   0          5m14s
kube-scheduler-minikube                    1/1     Running   0          5m19s
metrics-server-9d74bb658-rtxjx             1/1     Running   0          2m1s
storage-provisioner                        1/1     Running   0          5m17s
PS C:\Users\Vela\Desktop\SA\LAB\PRACTICAS\P5\helm\comicrent> minikube image load comicrent/api-gateway:1.0.0
>> minikube image load comicrent/auth-service:1.0.0
>> minikube image load comicrent/comics-service:1.0.0
>> minikube image load comicrent/rentals-service:1.0.0
>> minikube image load comicrent/copies-service:1.0.0
>> minikube image load comicrent/operations-jobs:1.0.0
PS C:\Users\Vela\Desktop\SA\LAB\PRACTICAS\P5\helm\comicrent> minikube image load bitnamilegacy/rabbitmq:3.13.5-debian-12-r1
PS C:\Users\Vela\Desktop\SA\LAB\PRACTICAS\P5\helm\comicrent> minikube image ls |
>>   Select-String `
>>     "comicrent",`
>>     "rabbitmq"

docker.io/comicrent/rentals-service:1.0.0
docker.io/comicrent/operations-jobs:1.0.0
docker.io/comicrent/copies-service:1.0.0
docker.io/comicrent/comics-service:1.0.0
docker.io/comicrent/auth-service:1.0.0
docker.io/comicrent/api-gateway:1.0.0
docker.io/bitnamilegacy/rabbitmq:3.13.5-debian-12-r1

PS C:\Users\Vela\Desktop\SA\LAB\PRACTICAS\P5\helm\comicrent> helm dependency update
Hang tight while we grab the latest from your chart repositories...
...Successfully got an update from the "bitnami" chart repository
Update Complete. ⎈Happy Helming!⎈
Saving 9 charts
Dependency api-gateway did not declare a repository. Assuming it exists in the charts directory
Dependency auth-service did not declare a repository. Assuming it exists in the charts directory
Dependency comics-service did not declare a repository. Assuming it exists in the charts directory
Dependency rentals-service did not declare a repository. Assuming it exists in the charts directory
Dependency copies-service did not declare a repository. Assuming it exists in the charts directory
Dependency copies-consumer did not declare a repository. Assuming it exists in the charts directory
Downloading postgresql from repo https://charts.bitnami.com/bitnami
Pulled: registry-1.docker.io/bitnamicharts/postgresql:18.8.9
Digest: sha256:059725d5ac01b5bbb00a7f1c8d1c63c66859936638b525a590eab8d8d666a2bb
Downloading rabbitmq from repo https://charts.bitnami.com/bitnami
Deleting outdated charts
PS C:\Users\Vela\Desktop\SA\LAB\PRACTICAS\P5\helm\comicrent> helm lint . -f values-dev.yaml
==> Linting .
[INFO] Chart.yaml: icon is recommended

1 chart(s) linted, 0 chart(s) failed
PS C:\Users\Vela\Desktop\SA\LAB\PRACTICAS\P5\helm\comicrent> helm install comicrent . `
>>   -f values-dev.yaml `
>>   --wait `
>>   --timeout 10m
NAME: comicrent
LAST DEPLOYED: Tue Aug 25 00:10:40 2026
NAMESPACE: default
STATUS: deployed
REVISION: 1
DESCRIPTION: Install complete
TEST SUITE: None
PS C:\Users\Vela\Desktop\SA\LAB\PRACTICAS\P5\helm\comicrent> kubectl get pods -n sa-p5
NAME                                          READY   STATUS      RESTARTS      AGE
comicrent-api-gateway-6485d6cdd4-wxlwx        1/1     Running     0             2m26s
comicrent-auth-service-5dffc876fd-rlztx       1/1     Running     0             2m26s
comicrent-comics-service-6fdf6c8957-2mjwf     1/1     Running     0             2m26s
comicrent-copies-consumer-67bc59bc77-b69x9    1/1     Running     0             2m26s
comicrent-copies-service-984f97c77-crfv6      1/1     Running     1 (54s ago)   2m26s
comicrent-cron-tick-29793972-n4m6v            0/1     Completed   0             68s
comicrent-postgresql-0                        1/1     Running     0             2m26s
comicrent-rabbitmq-0                          1/1     Running     0             2m26s
comicrent-rentals-service-dd598646-vr2xc      1/1     Running     1 (52s ago)   2m26s
comicrent-summary-consumer-6894ddff77-f2nr4   1/1     Running     0             2m26s




PS C:\Users\Vela\Desktop\SA\LAB\PRACTICAS\P5\helm\comicrent> kubectl get pods -n sa-p5
>> kubectl get networkpolicy -n sa-p5
NAME                                          READY   STATUS      RESTARTS        AGE
comicrent-api-gateway-6485d6cdd4-wxlwx        1/1     Running     0               4m20s
comicrent-auth-service-5dffc876fd-rlztx       1/1     Running     0               4m20s
comicrent-comics-service-6fdf6c8957-2mjwf     1/1     Running     0               4m20s
comicrent-copies-consumer-67bc59bc77-b69x9    1/1     Running     0               4m20s
comicrent-copies-service-984f97c77-crfv6      1/1     Running     1 (2m48s ago)   4m20s
comicrent-cron-tick-29793972-n4m6v            0/1     Completed   0               3m2s
comicrent-cron-tick-29793974-dcbdf            0/1     Completed   0               62s
comicrent-postgresql-0                        1/1     Running     0               4m20s
comicrent-rabbitmq-0                          1/1     Running     0               4m20s
comicrent-rentals-service-dd598646-vr2xc      1/1     Running     1 (2m46s ago)   4m20s
comicrent-summary-consumer-6894ddff77-f2nr4   1/1     Running     1 (105s ago)    4m20s
NAME                        POD-SELECTOR                                                                                                 AGE
comicrent-allow-dns         <none>                                                                                                       4m21s
comicrent-api-gateway       app.kubernetes.io/instance=comicrent,app.kubernetes.io/name=api-gateway                                      4m21s
comicrent-auth-service      app.kubernetes.io/instance=comicrent,app.kubernetes.io/name=auth-service                                     4m21s
comicrent-comics-service    app.kubernetes.io/instance=comicrent,app.kubernetes.io/name=comics-service                                   4m21s
comicrent-copies-consumer   app.kubernetes.io/instance=comicrent,app.kubernetes.io/name=copies-consumer                                  4m21s
comicrent-copies-service    app.kubernetes.io/instance=comicrent,app.kubernetes.io/name=copies-service                                   4m21s
comicrent-cron-summary      app.kubernetes.io/name=cron-summary                                                                          4m21s
comicrent-cron-tick         app.kubernetes.io/name=cron-tick                                                                             4m21s
comicrent-default-deny      <none>                                                                                                       4m21s
comicrent-postgresql        app.kubernetes.io/component=primary,app.kubernetes.io/instance=comicrent,app.kubernetes.io/name=postgresql   4m21s
comicrent-rabbitmq          app.kubernetes.io/instance=comicrent,app.kubernetes.io/name=rabbitmq                                         4m21s
comicrent-rentals-service   app.kubernetes.io/instance=comicrent,app.kubernetes.io/name=rentals-service                                  4m21s

