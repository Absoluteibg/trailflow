import { Tool, ToolInput } from './base';
import { z } from 'zod';
import { AgentRuntime } from '../agent/runtime';
import { getDb } from '../db';
import { logger } from '../logger';

const DelegateTaskSchema = z.object({
  task: z.string().min(1, 'Task description cannot be empty'),
  context_summary: z.string().optional()
});

export class DelegateTaskTool extends Tool {
  name = 'delegate_task';
  description = 'Spawn a sub-agent to handle a specific subtask. Useful for delegating complex or isolated work. Returns the final answer from the sub-agent.';
  inputs = {
    task: { type: 'string', description: 'Detailed description of the task for the sub-agent.', required: true },
    context_summary: { type: 'string', description: 'Optional summary of the current state or relevant context to pass to the sub-agent.', required: false }
  };
  protected schema = DelegateTaskSchema;

  // We need to know the parent session to track lineage, but our tool interface
  // currently doesn't pass the sessionId to `forward`. We can prefix the generated sessionId.
  // We'll generate a unique ID for the sub-agent.
  async forward(input: ToolInput): Promise<string> {
    const validation = this.validateInput(input);
    if (!validation.valid) return `Error: Invalid input - ${validation.error}`;

    const subAgentId = `sub_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const task = validation.data.task;
    const context = validation.data.context_summary;

    let fullPrompt = task;
    if (context) {
      fullPrompt = `[Parent Context]\n${context}\n\n[Your Task]\n${task}`;
    }

    logger.info({ subAgentId, task }, 'Spawning sub-agent');

    const db = await getDb();
    await db.run('INSERT OR IGNORE INTO sessions (id) VALUES (?)', [subAgentId]);
    await db.run('INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)', [subAgentId, 'user', fullPrompt]);

    const agent = new AgentRuntime();
    
    try {
      const result = await agent.runTask(subAgentId, fullPrompt);
      return `Sub-agent completed task.\nResult:\n${result}`;
    } catch (e: any) {
      return `Sub-agent failed with error: ${e.message}`;
    }
  }
}
