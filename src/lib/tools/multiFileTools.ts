import fs from 'fs';
import path from 'path';
import { Tool, ToolInput } from './base';
import { config } from '../config';
import { z } from 'zod';
import { getDb } from '../db';
import { logger } from '../logger';

const AtomicEditSchema = z.object({
  edits: z.array(z.object({
    file_path: z.string(),
    content: z.string()
  })).min(1, 'At least one file edit is required')
});

const RollbackSchema = z.object({
  operation_id: z.string().min(1, 'Operation ID is required')
});

interface BackupRecord {
  file_path: string;
  original_content: string | null; // null if file didn't exist
}

export class AtomicMultiFileEditTool extends Tool {
  name = 'atomic_multi_edit';
  description = 'Apply edits to multiple files atomically. If writing any file fails, the entire operation is rolled back. Returns an operation ID that can be used for explicit rollback later.';
  inputs = {
    edits: {
      type: 'array',
      description: 'Array of objects containing { file_path: string, content: string } for each file to edit/create.',
      required: true
    }
  };
  protected schema = AtomicEditSchema;

  async forward(input: ToolInput): Promise<string> {
    const validation = this.validateInput(input);
    if (!validation.valid) return `Error: Invalid input - ${validation.error}`;

    const workspaceRoot = path.resolve(process.cwd(), config.WORKSPACE_DIR);
    const edits = validation.data.edits;
    
    // Validate all paths are within workspace
    for (const edit of edits) {
      const fullPath = path.resolve(workspaceRoot, edit.file_path);
      if (!fullPath.startsWith(workspaceRoot)) {
        return `Error: File path ${edit.file_path} is outside workspace.`;
      }
    }

    const backups: BackupRecord[] = [];
    const operationId = `op_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    try {
      // 1. Create backups
      for (const edit of edits) {
        const fullPath = path.resolve(workspaceRoot, edit.file_path);
        if (fs.existsSync(fullPath)) {
          backups.push({
            file_path: fullPath,
            original_content: fs.readFileSync(fullPath, 'utf8')
          });
        } else {
          backups.push({
            file_path: fullPath,
            original_content: null
          });
        }
      }

      // 2. Apply all edits
      for (const edit of edits) {
        const fullPath = path.resolve(workspaceRoot, edit.file_path);
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(fullPath, edit.content, 'utf8');
      }

      // 3. Store backup record in memory/DB for rollback
      const db = await getDb();
      // We can reuse the tasks or messages table, or simply store it in a JSON file
      const backupDir = path.resolve(process.cwd(), 'data', 'backups');
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
      fs.writeFileSync(path.join(backupDir, `${operationId}.json`), JSON.stringify(backups));

      return `Successfully applied edits to ${edits.length} files. Operation ID: ${operationId}`;
      
    } catch (e: any) {
      // Rollback immediately if something failed during apply
      logger.error({ error: e.message, operationId }, 'Atomic edit failed, rolling back');
      for (const backup of backups) {
        if (backup.original_content === null) {
          if (fs.existsSync(backup.file_path)) fs.unlinkSync(backup.file_path);
        } else {
          fs.writeFileSync(backup.file_path, backup.original_content, 'utf8');
        }
      }
      return `Error applying edits: ${e.message}. All changes have been rolled back.`;
    }
  }
}

export class RollbackTool extends Tool {
  name = 'rollback_edit';
  description = 'Revert a previous atomic multi-file edit using its Operation ID.';
  inputs = {
    operation_id: { type: 'string', description: 'The Operation ID returned by atomic_multi_edit', required: true }
  };
  protected schema = RollbackSchema;

  async forward(input: ToolInput): Promise<string> {
    const validation = this.validateInput(input);
    if (!validation.valid) return `Error: Invalid input - ${validation.error}`;

    const opId = validation.data.operation_id;
    // Prevent directory traversal
    if (opId.includes('/') || opId.includes('\\') || opId.includes('..')) {
      return `Error: Invalid operation ID.`;
    }

    const backupFile = path.resolve(process.cwd(), 'data', 'backups', `${opId}.json`);
    if (!fs.existsSync(backupFile)) {
      return `Error: Backup not found for operation ID ${opId}`;
    }

    try {
      const backups: BackupRecord[] = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
      
      for (const backup of backups) {
        if (backup.original_content === null) {
          if (fs.existsSync(backup.file_path)) fs.unlinkSync(backup.file_path);
        } else {
          fs.writeFileSync(backup.file_path, backup.original_content, 'utf8');
        }
      }
      
      return `Successfully rolled back operation ${opId}.`;
    } catch (e: any) {
      return `Error during rollback: ${e.message}`;
    }
  }
}
