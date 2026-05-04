# Backend Scalable Service on Kubernetes

This project demonstrates building and deploying a scalable backend service on Kubernetes with:

- Backend API
- Docker image
- Kubernetes Deployment + Service + Ingress
- HPA (CPU based autoscaling)
- MongoDB StatefulSet + ReplicaSet
- High availability and data persistence validation

## Project Explanation

This project is an end-to-end implementation of a production-like backend environment on Kubernetes.  
It starts with a containerized Node.js backend API, then deploys it using Kubernetes best practices for networking, scalability, and resilience.

The main goal is to prove that the application can:

- serve requests through Ingress,
- scale automatically when CPU load increases,
- keep working during pod failures,
- and preserve database data through restarts and failover scenarios.

By combining backend deployment, autoscaling, and a replicated MongoDB database, the project demonstrates core DevOps concepts required for real-world cloud systems.

## Architecture Explanation

The system follows a layered architecture:

1. **Client Layer**  
   Users send HTTP requests to the public endpoint (for example `backend.local`).

2. **Ingress Layer (NGINX Ingress Controller)**  
   Ingress receives external traffic and routes requests to the backend Kubernetes Service.

3. **Service Layer (Cluster Networking)**  
   `backend-service` provides a stable internal endpoint and load-balances traffic across backend pods.

4. **Application Layer (Backend Deployment)**  
   The backend runs as a Deployment with multiple replicas.  
   HPA monitors CPU usage and scales pods between `minReplicas: 1` and `maxReplicas: 5` (target ~70% CPU).

5. **Data Layer (MongoDB StatefulSet + ReplicaSet)**  
   MongoDB runs as a StatefulSet (`mongo-0`, `mongo-1`, `mongo-2`) with stable network identities and persistent storage.  
   ReplicaSet `rs0` provides PRIMARY/SECONDARY replication, failover, and data durability.

This architecture ensures availability, scalability, and persistence, even when individual pods are deleted or restarted.

## Project Requirements

1. Build a simple backend API (for example CRUD endpoints).
2. Dockerize the application.
3. Deploy to cloud/Kubernetes.
4. Use Kubernetes Deployment for backend.
5. Configure autoscaling with:
  - `minReplicas: 1`
  - `maxReplicas: 5`
6. Implement HPA based on CPU usage.
7. Deploy MongoDB as StatefulSet with ReplicaSet.
8. Expose backend with Service and Ingress.

## Acceptance / Validation

- API is accessible through Ingress.
- Autoscaling works under load (pods increase).
- High availability works:
  - Delete backend pod -> app still works.
  - Delete Mongo pod -> data still exists.
- Mongo ReplicaSet is configured correctly.
- No data loss after pod restarts/failover.

## Suggested Build Order

1. Build backend API.
2. Dockerize and push image.
3. Deploy backend (Deployment + Service).
4. Configure Ingress.
5. Configure HPA.
6. Configure Mongo StatefulSet + ReplicaSet.
7. Run validation tests.

## 1) Install Ingress Controller

Install NGINX Ingress Controller:

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yaml
```

Verify:

```bash
kubectl get pods -n ingress-nginx
```

## 2) Backend Deployment and Service

Apply manifests:

```bash
kubectl apply -f K8s/deployment.yaml
kubectl apply -f K8s/service.yaml
```

Check:

```bash
kubectl get pods
kubectl get svc
```

## 3) Ingress Configuration

Apply ingress:

```bash
kubectl apply -f K8s/ingress.yaml
kubectl get ingress
```

Important for NGINX controller binding:

- Ensure `ingressClassName: nginx` is set in `K8s/ingress.yaml`.

For KillerShell/Killercoda environments:

- `ADDRESS` in `kubectl get ingress` can be empty (this is normal).
- Use port-forward on ingress controller service:

```bash
kubectl port-forward -n ingress-nginx service/ingress-nginx-controller 8080:80
```

Test with host header:

```bash
curl -H "Host: backend.local" http://localhost:8080
```

## 4) Create and Manage HPA

Create HPA for `backend-deployment`:

```bash
kubectl autoscale deployment backend-deployment --cpu-percent=70 --min=1 --max=5
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

Important note:

- `kubectl autoscale ...` creates a new HPA (it does not update an existing one with the same name).
- To change target (for example `70` -> `40`), use `kubectl edit hpa ...` or delete/recreate HPA.

## 5) Load Test the Backend

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

Note about scale down:

- HPA scales up quickly.
- Scale down can take time due to stabilization/cooldown behavior.

## 6) Install / Fix Metrics Server (Required for HPA)

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

If `kubectl top` works, metrics-server is healthy and HPA can scale.

## 7) MongoDB StatefulSet + ReplicaSet

Apply Mongo service and statefulset:

```bash
kubectl apply -f K8s/mongo-service.yaml
kubectl apply -f K8s/mongo-statefulset.yaml
kubectl get pods
```

### Why ReplicaSet is still needed if replicas = 3?

- `replicas: 3` in Kubernetes means 3 pods are running.
- It does not automatically configure Mongo replication.
- MongoDB ReplicaSet (`rs.initiate`) is required for:
  - PRIMARY/SECONDARY roles
  - data replication
  - failover

### Initialize ReplicaSet

Enter one MongoDB pod:

```bash
kubectl exec -it mongo-0 -- mongosh
```

Initialize:

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

Verify:

```javascript
rs.status()
```

If you use only 2 Mongo replicas, members must match exactly 2 nodes.

## 8) Backend Mongo Connection Example

Use ReplicaSet connection string:

```javascript
mongoose.connect(
  "mongodb://mongo-0.mongo:27017,mongo-1.mongo:27017,mongo-2.mongo:27017/mydb?replicaSet=rs0"
);
```

`mongo-0.mongo` works because the Mongo Service is headless and gives stable DNS per pod.

## 9) Test MongoDB Data Persistence

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

Expected output should include your inserted document:

```javascript
{ name: "tarek", role: "devops" }
```

## 10) Deliverables Checklist

- GitHub repository includes:
  - source code
  - `Dockerfile`
  - Kubernetes manifests
- README includes:
  - setup steps
  - API endpoint test steps
- Video (Arabic or English) includes:
  - architecture explanation
  - running system demo
  - autoscaling demo
  - failover demo (delete backend pod and Mongo pod)

## 11) Troubleshooting (Real Issues and Fixes)

### Issue A: `Cannot find module 'mongoose'`

Error:

```bash
Error: Cannot find module 'mongoose'
Require stack:
- /app/index.js
```

Why it happened:

- Backend code required `mongoose`, but running container image did not include it (old image was still used).

Fix:

1. Add dependency to backend:

```bash
cd backend
npm install mongoose
```

1. Rebuild and push image (`latest`):

```bash
docker build --no-cache -f backend/Dockerfile -t tarekadel/backend-image:latest backend
docker push tarekadel/backend-image:latest
```

1. Verify image locally before deploy:

```bash
docker run --rm tarekadel/backend-image:latest node -e "console.log(require('mongoose').version)"
```

1. Ensure deployment always pulls latest:

```yaml
image: tarekadel/backend-image:latest
imagePullPolicy: Always
```

1. Restart deployment:

```bash
kubectl rollout restart deployment/backend-deployment
kubectl rollout status deployment/backend-deployment
```

### Issue B: Ingress returns `404 Not Found (nginx)`

Error:

```bash
curl -H "Host: backend.local" http://localhost:8080
# 404 Not Found (nginx)
```

Why it happened:

- Ingress resource was not present in cluster at that moment (`No resources found` for ingress).

Fix:

1. Apply ingress from correct project path:

```bash
cd ~/internship-acceptance-units-task
kubectl apply -f K8s/ingress.yaml -n default
```

1. Verify ingress exists and routes to backend service:

```bash
kubectl describe ingress backend-ingress -n default
```

1. Keep ingress controller port-forward running in one terminal:

```bash
kubectl port-forward -n ingress-nginx service/ingress-nginx-controller 8080:80
```

1. Test in another terminal:

```bash
curl -H "Host: backend.local" http://localhost:8080
```

Expected success response:

```text
API is working 🚀
```

### Issue C: `kubectl apply -f K8s/service.yaml` path not found

Error:

```bash
error: the path "K8s/service.yaml" does not exist
```

Why it happened:

- Command was run from `~` instead of repository folder.

Fix:

```bash
cd ~/internship-acceptance-units-task
kubectl apply -f K8s/service.yaml
```

### Issue D: Mongo ReplicaSet initialized but all members show `SECONDARY`

Observed state after `rs.initiate(...)`:

- `ok: 1` (init succeeded)
- members were temporarily all `SECONDARY`
- backend could still show `ReplicaSetNoPrimary` until election completes

Why it happened:

- Immediately after initialization, ReplicaSet can need a short time to elect a `PRIMARY`.

Fix / validation:

1. Wait a short period (10 to 30 seconds), then recheck:

```javascript
rs.status().members.map(m => ({ name: m.name, state: m.stateStr }))
```

1. If no `PRIMARY` appears, force election from one node (for example `mongo-0`):

```javascript
rs.stepUp()
```

1. Confirm primary election:

```javascript
rs.isMaster()
// or
db.hello()
```

Expected result:

- one member becomes `PRIMARY`
- remaining members stay `SECONDARY`
- backend Mongo connection error `ReplicaSetNoPrimary` should disappear

