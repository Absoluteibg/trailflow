import fs from 'fs';
import path from 'path';

const backupDir = path.resolve(process.cwd(), 'data/backups');
const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS ?? '14');
const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000;
const now = Date.now();

if (!fs.existsSync(backupDir)) {
  console.log('No backups directory found; nothing to prune.');
  process.exit(0);
}

let deleted = 0;
for (const file of fs.readdirSync(backupDir)) {
  const fullPath = path.join(backupDir, file);
  const stat = fs.statSync(fullPath);
  if (!stat.isFile()) continue;
  if (now - stat.mtimeMs > maxAgeMs) {
    fs.unlinkSync(fullPath);
    deleted += 1;
  }
}

console.log(`Retention complete. Deleted ${deleted} backup file(s).`);
