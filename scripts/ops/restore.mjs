import fs from 'fs';
import path from 'path';

const source = process.argv[2];
if (!source) {
  console.error('Usage: node scripts/ops/restore.mjs <backup-file-path>');
  process.exit(1);
}

const sourcePath = path.resolve(process.cwd(), source);
const targetPath = path.resolve(process.cwd(), 'data/trailflow.db');

if (!fs.existsSync(sourcePath)) {
  console.error(`Backup file not found: ${sourcePath}`);
  process.exit(1);
}

fs.mkdirSync(path.dirname(targetPath), { recursive: true });
fs.copyFileSync(sourcePath, targetPath);
console.log(`Restored database from ${sourcePath} to ${targetPath}`);
