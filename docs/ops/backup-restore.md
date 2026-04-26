# Backup and Restore

## SQLite backup

- Run `npm run backup`
- Backup files are written under `data/backups/`.

## Restore from backup

- Stop the app first.
- Run `npm run restore -- data/backups/<backup-file>.db`
- Start the app and validate `GET /api/health`.

## PostgreSQL backup example

- `pg_dump "$DATABASE_URL" > trailflow-postgres-backup.sql`
- Restore: `psql "$DATABASE_URL" < trailflow-postgres-backup.sql`

## Kubernetes CronJob example

Use this CronJob pattern to run periodic backups:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: trailflow-backup
spec:
  schedule: "0 */6 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: backup
              image: trailflow:latest
              command: ["node", "scripts/ops/backup.mjs"]
```
