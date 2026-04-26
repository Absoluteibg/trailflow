import fs from 'fs';
import path from 'path';

const dataDir = path.resolve(process.cwd(), 'data');
const source = path.join(dataDir, 'trailflow.db');
const backupDir = path.join(dataDir, 'backups');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const target = path.join(backupDir, `trailflow-${timestamp}.db`);

if (!fs.existsSync(source)) {
  console.error(`No SQLite database found at ${source}`);
  process.exit(1);
}

fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync(source, target);
console.log(`Backup created: ${target}`);
