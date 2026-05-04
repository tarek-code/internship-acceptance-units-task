# Kubernetes Deployment Notes

This README contains the commands and flow used in this project for:
- Ingress setup
- HPA setup and testing
- MongoDB ReplicaSet initialization
- Metrics Server setup
- MongoDB data persistence check

## 1) Install Ingress Controller

Install NGINX Ingress Controller in the Kubernetes cluster:

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yaml
```

## 2) Create and Manage HPA

Create HPA for `backend-deployment`:

```bash
kubectl autoscale deployment backend-deployment --cpu-percent=40 --min=1 --max=5
```

Check HPA and pods:

```bash
kubectl get hpa
kubectl get pods
```

Edit HPA if needed:

```bash
kubectl edit hpa backend-deployment
```

## 3) Load Test the Backend

Create a temporary load-generator pod:

```bash
kubectl run -i --tty load-generator --rm --image=busybox -- /bin/sh
```

Run load command inside the pod:

```bash
while true; do wget -q -O- http://backend-service; done
```

Delete the load test pod manually (if needed):

```bash
kubectl delete pod load-generator
```

## 4) Configure MongoDB ReplicaSet

Enter one MongoDB pod:

```bash
kubectl exec -it mongo-0 -- mongosh
```

Initialize ReplicaSet:

```javascript
rs.initiate({
  _id: "rs0",
  members: [
    { _id: 0, host: "mongo-0.mongo:27017" },
    { _id: 1, host: "mongo-1.mongo:27017" },
    { _id: 2, host: "mongo-2.mongo:27017" }
  ]
})
```

Verify status:

```javascript
rs.status()
```

## 5) Install / Fix Metrics Server

Check if Metrics Server is installed:

```bash
kubectl get deployment metrics-server -n kube-system
```

If not found, install it:

```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

Verify:

```bash
kubectl get pods -n kube-system
```

Edit Metrics Server deployment:

```bash
kubectl edit deployment metrics-server -n kube-system
```

Set args like this:

```yaml
args:
  - --cert-dir=/tmp
  - --secure-port=10250
  - --kubelet-preferred-address-types=InternalIP
  - --kubelet-insecure-tls
```

Restart and describe deployment:

```bash
kubectl rollout restart deployment metrics-server -n kube-system
kubectl describe deployment metrics-server -n kube-system
```

Check resource usage:

```bash
kubectl top nodes
kubectl top pods
```

## 6) Test MongoDB Data Persistence

Connect to MongoDB:

```bash
kubectl exec -it mongo-0 -- mongosh
```

Run:

```javascript
use testdb
db.users.insertOne({ name: "tarek", role: "devops" })
db.users.find()
exit
```

Delete one Mongo pod and watch recovery:

```bash
kubectl delete pod mongo-0
kubectl get pods -w
```

Reconnect and check data again:

```bash
kubectl exec -it mongo-0 -- mongosh
```

```javascript
use testdb
db.users.find()
```

Expected output should include your inserted document (example noted in your test):

```javascript
{ name: "tarek", role: "devops" }
```