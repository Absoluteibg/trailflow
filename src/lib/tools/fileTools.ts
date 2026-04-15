import fs from 'fs';
import path from 'path';
import { Tool, ToolInput } from './base';
import { logger } from '../logger';

export class ReadFileTool extends Tool {
  name = 'read_file';
  description = 'Read the full content of a file inside the workspace. Returns file content as a string.';
  inputs = {
    path: { type: 'string', description: 'Relative path within workspace.', required: true }
  };

  async forward(input: ToolInput): Promise<string> {
    const fullPath = this.safeResolve(input.path);
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
    content: { type: 'string', description: 'Content to write.', required: true }
  };

  async forward(input: ToolInput): Promise<string> {
    const fullPath = this.safeResolve(input.path);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, input.content, 'utf8');
    const bytes = Buffer.byteLength(input.content, 'utf8');
    logger.info({ path: input.path, bytes }, 'File written');
    return `Successfully wrote ${bytes} bytes to ${input.path}`;
  }
}

export class ListFilesTool extends Tool {
  name = 'list_files';
  description = 'List all files and directories in the workspace or a subdirectory. Returns a formatted tree.';
  inputs = {
    path: { type: 'string', description: 'Relative path within workspace (default: .)', required: false },
    max_depth: { type: 'number', description: 'Max depth to recurse (default: 3)', required: false }
  };

  async forward(input: ToolInput): Promise<string> {
    const relPath = input.path || '.';
    const fullPath = this.safeResolve(relPath);
    const maxDepth = Math.min(input.max_depth || 3, 5);

    const buildTree = (dir: string, depth: number): string => {
      if (depth > maxDepth) return '';
      let result = '';
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
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

  async forward(input: ToolInput): Promise<string> {
    const fullPath = this.safeResolve(input.path);
    fs.mkdirSync(fullPath, { recursive: true });
    return `Successfully created directory: ${input.path}`;
  }
}

export class DeleteFileTool extends Tool {
  name = 'delete_file';
  description = 'Delete a specific file from the workspace. Requires confirm=true to execute.';
  inputs = {
    path: { type: 'string', description: 'Relative path within workspace.', required: true },
    confirm: { type: 'boolean', description: 'Must be true to proceed.', required: true }
  };

  async forward(input: ToolInput): Promise<string> {
    if (!input.confirm) return 'Error: Deletion not confirmed.';
    const fullPath = this.safeResolve(input.path);
    if (!fs.existsSync(fullPath)) return `Error: File not found: ${input.path}`;
    if (fs.statSync(fullPath).isDirectory()) return `Error: Use a directory tool to delete directories (not implemented for safety).`;
    
    fs.unlinkSync(fullPath);
    logger.info({ path: input.path }, 'File deleted');
    return `Successfully deleted file: ${input.path}`;
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

  async forward(input: ToolInput): Promise<string> {
    const fullPath = this.safeResolve(input.path);
    if (!fs.existsSync(fullPath)) return `Error: File not found: ${input.path}`;
    
    const content = fs.readFileSync(fullPath, 'utf8');
    if (!content.includes(input.old_str)) {
      return `Error: Could not find exact match for "old_str" in ${input.path}`;
    }
    
    const newContent = content.replace(input.old_str, input.new_str);
    fs.writeFileSync(fullPath, newContent, 'utf8');
    logger.info({ path: input.path }, 'File edited');
    return `Successfully edited ${input.path}`;
  }
}
