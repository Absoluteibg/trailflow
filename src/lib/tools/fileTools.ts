import fs from 'fs';
import path from 'path';
import { Tool, ToolInput } from './base';
import { config } from '../config';
import { z } from 'zod';

const ReadFileSchema = z.object({
  path: z.string().min(1, 'Path cannot be empty')
});

const WriteFileSchema = z.object({
  path: z.string().min(1, 'Path cannot be empty'),
  content: z.string(),
  mode: z.enum(['overwrite', 'append']).optional().default('overwrite')
});

const ListFilesSchema = z.object({
  path: z.string().optional().default('.'),
  max_depth: z.number().min(1).max(5).optional().default(3)
});

const CreateDirSchema = z.object({
  path: z.string().min(1, 'Path cannot be empty')
});

const DeleteFileSchema = z.object({
  path: z.string().min(1, 'Path cannot be empty'),
  confirm: z.boolean().refine(v => v === true, 'Confirmation must be true')
});

const EditFileSchema = z.object({
  path: z.string().min(1, 'Path cannot be empty'),
  old_str: z.string(),
  new_str: z.string()
});

export class ReadFileTool extends Tool {
  name = 'read_file';
  description = 'Read the full content of a file inside the workspace. Returns file content as a string.';
  inputs = {
    path: { type: 'string', description: 'Relative path within workspace.', required: true }
  };
  protected schema = ReadFileSchema;

  async forward(input: ToolInput): Promise<string> {
    const validation = this.validateInput(input);
    if (!validation.valid) return `Error: Invalid input - ${validation.error}`;

    const fullPath = this.safeResolve(validation.data.path);
    if (!fs.existsSync(fullPath)) return `Error: File not found at ${input.path}`;

    const stats = fs.statSync(fullPath);
    if (stats.size > 512 * 1024) {
      const content = fs.readFileSync(fullPath, 'utf8').substring(0, 512 * 1024);
      return `Warning: File too large, truncated to 512KB:\n\n${content}`;
    }

    return fs.readFileSync(fullPath, 'utf8');
  }
}

export class WriteFileTool extends Tool {
  name = 'write_file';
  description = 'Write content to a file inside the workspace. Creates the file if it does not exist. Overwrites existing content.';
  inputs = {
    path: { type: 'string', description: 'Relative path within workspace.', required: true },
    content: { type: 'string', description: 'Content to write.', required: true },
    mode: { type: 'string', description: 'Mode: "overwrite" or "append" (default: "overwrite")', required: false }
  };
  protected schema = WriteFileSchema;

  async forward(input: ToolInput): Promise<string> {
    const validation = this.validateInput(input);
    if (!validation.valid) return `Error: Invalid input - ${validation.error}`;

    const fullPath = this.safeResolve(validation.data.path);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const mode = validation.data.mode;
    if (mode === 'append') {
      fs.appendFileSync(fullPath, validation.data.content, 'utf8');
    } else {
      fs.writeFileSync(fullPath, validation.data.content, 'utf8');
    }

    const bytes = Buffer.byteLength(validation.data.content, 'utf8');
    return `Successfully wrote ${bytes} bytes to ${validation.data.path} (${mode})`;
  }
}

export class ListFilesTool extends Tool {
  name = 'list_files';
  description = 'List all files and directories in the workspace or a subdirectory. Returns a formatted tree.';
  inputs = {
    path: { type: 'string', description: 'Relative path within workspace (default: .)', required: false },
    max_depth: { type: 'number', description: 'Max depth to recurse (default: 3)', required: false }
  };
  protected schema = ListFilesSchema;

  async forward(input: ToolInput): Promise<string> {
    const validation = this.validateInput(input);
    if (!validation.valid) return `Error: Invalid input - ${validation.error}`;

    const relPath = validation.data.path;
    const fullPath = this.safeResolve(relPath);
    const maxDepth = validation.data.max_depth;

    const buildTree = (dir: string, depth: number): string => {
      if (depth > maxDepth) return '';
      let result = '';
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        // Skip massive directories to prevent context window bloat
        if (entry.isDirectory() && ['node_modules', '.git', 'dist', 'build', '.env'].includes(entry.name)) {
          continue;
        }
        
        const indent = '  '.repeat(depth);
        if (entry.isDirectory()) {
          result += `${indent}${entry.name}/\n`;
          result += buildTree(path.join(dir, entry.name), depth + 1);
        } else {
          result += `${indent}${entry.name}\n`;
        }
      }
      return result;
    };

    return buildTree(fullPath, 0) || '(empty)';
  }
}

export class CreateDirTool extends Tool {
  name = 'create_dir';
  description = 'Create a directory (and all parents) inside the workspace.';
  inputs = {
    path: { type: 'string', description: 'Relative path within workspace.', required: true }
  };
  protected schema = CreateDirSchema;

  async forward(input: ToolInput): Promise<string> {
    const validation = this.validateInput(input);
    if (!validation.valid) return `Error: Invalid input - ${validation.error}`;

    const fullPath = this.safeResolve(validation.data.path);
    fs.mkdirSync(fullPath, { recursive: true });
    return `Successfully created directory: ${validation.data.path}`;
  }
}

export class DeleteFileTool extends Tool {
  name = 'delete_file';
  description = 'Delete a specific file from the workspace. Requires confirm=true to execute.';
  inputs = {
    path: { type: 'string', description: 'Relative path within workspace.', required: true },
    confirm: { type: 'boolean', description: 'Must be true to execute.', required: true }
  };
  protected schema = DeleteFileSchema;

  async forward(input: ToolInput): Promise<string> {
    const validation = this.validateInput(input);
    if (!validation.valid) return `Error: Invalid input - ${validation.error}`;

    const fullPath = this.safeResolve(validation.data.path);
    if (!fs.existsSync(fullPath)) return `Error: File not found: ${validation.data.path}`;
    if (fs.statSync(fullPath).isDirectory()) return `Error: Use a directory tool to delete directories (not implemented for safety).`;

    fs.unlinkSync(fullPath);
    return `Successfully deleted file: ${validation.data.path}`;
  }
}

export class EditFileTool extends Tool {
  name = 'edit_file';
  description = 'Apply a targeted search-and-replace edit to a file inside the workspace. Replaces the first occurrence of old_str with new_str.';
  inputs = {
    path: { type: 'string', description: 'Relative path within workspace.', required: true },
    old_str: { type: 'string', description: 'Exact string to replace.', required: true },
    new_str: { type: 'string', description: 'New string to insert.', required: true }
  };
  protected schema = EditFileSchema;

  async forward(input: ToolInput): Promise<string> {
    const validation = this.validateInput(input);
    if (!validation.valid) return `Error: Invalid input - ${validation.error}`;

    const fullPath = this.safeResolve(validation.data.path);
    if (!fs.existsSync(fullPath)) return `Error: File not found: ${validation.data.path}`;

    const content = fs.readFileSync(fullPath, 'utf8');
    if (!content.includes(validation.data.old_str)) {
      return `Error: Could not find exact match for "old_str" in ${validation.data.path}`;
    }

    const newContent = content.replace(validation.data.old_str, validation.data.new_str);
    fs.writeFileSync(fullPath, newContent, 'utf8');
    return `Successfully edited ${validation.data.path}`;
  }
}
