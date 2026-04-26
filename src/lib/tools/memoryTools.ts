import fs from 'fs';
import path from 'path';
import { Tool, ToolInput } from './base';
import { config } from '../config';
import { z } from 'zod';

const MemoryReadSchema = z.object({});

const MemoryWriteSchema = z.object({
  content: z.string().min(1, 'Content cannot be empty'),
  mode: z.enum(['append', 'overwrite']).optional().default('append')
});

export class MemoryReadTool extends Tool {
  name = 'memory_read';
  description = "Read the current contents of MEMORY.md — the agent's persistent project memory.";
  inputs = {};
  protected schema = MemoryReadSchema;

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
  protected schema = MemoryWriteSchema;

  async forward(input: ToolInput): Promise<string> {
    const validation = this.validateInput(input);
    if (!validation.valid) return `Error: Invalid input - ${validation.error}`;

    const memoryPath = path.resolve(process.cwd(), config.WORKSPACE_DIR, 'MEMORY.md');
    const mode = validation.data.mode;

    if (mode === 'overwrite') {
      fs.writeFileSync(memoryPath, validation.data.content, 'utf8');
    } else {
      fs.appendFileSync(memoryPath, `\n${validation.data.content}`, 'utf8');
    }

    return `Successfully updated MEMORY.md (${mode})`;
  }
}

const SearchMemorySchema = z.object({
  query: z.string().min(1, 'Search query cannot be empty'),
  limit: z.number().min(1).max(50).optional().default(10)
});

export class SearchMemoryTool extends Tool {
  name = 'search_memory';
  description = 'Search through the agent\'s conversation history (messages table) for specific keywords or past context.';
  inputs = {
    query: { type: 'string', description: 'Keyword or phrase to search for in past messages.', required: true },
    limit: { type: 'number', description: 'Max number of results to return (default 10).', required: false }
  };
  protected schema = SearchMemorySchema;

  async forward(input: ToolInput): Promise<string> {
    const validation = this.validateInput(input);
    if (!validation.valid) return `Error: Invalid input - ${validation.error}`;

    const { query, limit } = validation.data;
    
    // To search the db, we need to access it. We can import getDb dynamically.
    const { getDb } = await import('../db');
    const db = await getDb();
    
    const rows = await db.all(
      'SELECT role, content, created_at FROM messages WHERE content LIKE ? ORDER BY created_at DESC LIMIT ?',
      [`%${query}%`, limit]
    );

    if (rows.length === 0) {
      return `No matches found in conversation history for: "${query}"`;
    }

    return rows.map((r: any) => `[${r.created_at}] ${r.role}:\n${r.content}`).join('\n\n---\n\n');
  }
}
