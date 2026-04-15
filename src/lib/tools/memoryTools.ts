import fs from 'fs';
import path from 'path';
import { Tool, ToolInput } from './base';
import { config } from '../config';

export class MemoryReadTool extends Tool {
  name = 'memory_read';
  description = "Read the current contents of MEMORY.md — the agent's persistent project memory.";
  inputs = {};

  async forward(input: ToolInput): Promise<string> {
    const memoryPath = path.resolve(process.cwd(), config.WORKSPACE_DIR, 'MEMORY.md');
    if (!fs.existsSync(memoryPath)) return '';
    return fs.readFileSync(memoryPath, 'utf8');
  }
}

export class MemoryWriteTool extends Tool {
  name = 'memory_write';
  description = 'Append a new section or overwrite the full MEMORY.md file. Use to persist important decisions, bugs, architecture notes.';
  inputs = {
    content: { type: 'string', description: 'Content to write.', required: true },
    mode: { type: 'string', description: 'Mode: "append" or "overwrite" (default: "append")', required: false }
  };

  async forward(input: ToolInput): Promise<string> {
    const memoryPath = path.resolve(process.cwd(), config.WORKSPACE_DIR, 'MEMORY.md');
    const mode = input.mode || 'append';

    if (mode === 'overwrite') {
      fs.writeFileSync(memoryPath, input.content, 'utf8');
    } else {
      fs.appendFileSync(memoryPath, `\n${input.content}`, 'utf8');
    }

    return `Successfully updated MEMORY.md (${mode})`;
  }
}
