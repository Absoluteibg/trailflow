# Data Retention

## Policy baseline

- Keep SQLite/PostgreSQL transactional data for 90 days (adjust by environment).
- Keep backups for 14 days by default.
- Keep operational metrics in Prometheus for 15 days (default local setup).

## Enforce backup retention

- Run: `npm run retention`
- Override days: `BACKUP_RETENTION_DAYS=30 npm run retention`

## Docker cron example

Use host cron to prune backups:

```bash
0 3 * * * cd /path/to/trailflow && BACKUP_RETENTION_DAYS=14 npm run retention >> retention.log 2>&1
```

## Kubernetes CronJob example

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: trailflow-retention
spec:
  schedule: "30 3 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: retention
              image: trailflow:latest
              env:
                - name: BACKUP_RETENTION_DAYS
                  value: "14"
              command: ["node", "scripts/ops/retention.mjs"]
```
