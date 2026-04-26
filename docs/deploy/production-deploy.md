# Trailflow Production Deployment

## Options

- Docker Compose full stack: `docker compose -f docker-compose.prod.yml up -d`
- Kubernetes manifests: apply files in `infra/k8s/`
- Helm chart: install from `infra/helm/trailflow/`

## Docker Compose

1. Copy `.env.example` to `.env` and set secrets.
2. Start services:
   - `docker compose -f docker-compose.prod.yml up -d --build`
3. Verify:
   - App health: `http://localhost:3000/api/health`
   - Prometheus: `http://localhost:9090`
   - Grafana: `http://localhost:3001`

## Kubernetes Manifests

1. Create secrets from `infra/k8s/secret.example.yaml`.
2. Apply:
   - `kubectl apply -f infra/k8s/configmap.yaml`
   - `kubectl apply -f infra/k8s/secret.example.yaml`
   - `kubectl apply -f infra/k8s/deployment.yaml`
   - `kubectl apply -f infra/k8s/service.yaml`
   - `kubectl apply -f infra/k8s/hpa.yaml`

## Helm

1. Review `infra/helm/trailflow/values.yaml`.
2. Install/upgrade:
   - `helm upgrade --install trailflow infra/helm/trailflow`
