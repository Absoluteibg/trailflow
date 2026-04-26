import { LLMRouter, LLMProvider } from "./llm";
import { buildContext } from "./context";
import { getToolByName, allTools } from "../tools";
import { getDb } from "../db";
import { logger } from "../logger";
import { config } from "../config";

// Tools that are safe to run in parallel (read-only, no side effects)
const PARALLEL_SAFE_TOOLS = ['read_file', 'list_files', 'git_status', 'git_diff', 'memory_read', 'search_code'];

// ---------------------------------------------------------------------------
// In-memory metrics — lightweight, zero dependencies
// ---------------------------------------------------------------------------
interface Metrics {
  tasksStarted: number;
  tasksCompleted: number;
  tasksFailed: number;
  tasksTimedOut: number;
  totalDurationMs: number;
  toolCalls: Record<string, number>;
}

const metrics: Metrics = {
  tasksStarted: 0,
  tasksCompleted: 0,
  tasksFailed: 0,
  tasksTimedOut: 0,
  totalDurationMs: 0,
  toolCalls: {},
};

export function getMetrics() {
  const avgDurationMs = metrics.tasksCompleted > 0
    ? Math.round(metrics.totalDurationMs / metrics.tasksCompleted)
    : 0;
  return { ...metrics, avgDurationMs };
}

function recordToolCall(toolName: string) {
  metrics.toolCalls[toolName] = (metrics.toolCalls[toolName] ?? 0) + 1;
}

export interface PlanStep {
  id?: number;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  plan_order: number;
  result?: string;
  parent_task_id?: number | null;
}

export class AgentRuntime {
  private llm: LLMProvider;

  constructor() {
    this.llm = new LLMRouter();
  }

  async createPlan(sessionId: string, objective: string): Promise<PlanStep[]> {
    const db = await getDb();

    // Create plan record
    const planResult = await db.run(
      'INSERT INTO plans (session_id, objective) VALUES (?, ?)',
      [sessionId, objective]
    );
    const planId = planResult.lastID;

    // Ask LLM to break down the objective into steps
    const planPrompt = `Break down this objective into 3-7 concrete, actionable steps.
Each step should be specific and verifiable.

Objective: ${objective}

Respond with ONLY a JSON array of steps in this format:
[
  {"description": "Step 1 description", "depends_on": null},
  {"description": "Step 2 description", "depends_on": 0} 
]
Note: depends_on is the zero-based index of the step that must be completed first, or null.

Do not include any other text.`;

    try {
      const response = await this.llm.chat([{ role: 'user', parts: [{ text: planPrompt }] }]);

      // Try to parse the JSON array from response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const steps = JSON.parse(jsonMatch[0]);
        const planSteps: PlanStep[] = [];

        for (let i = 0; i < steps.length; i++) {
          const parentIndex = steps[i].depends_on;
          const parentTaskId = (parentIndex !== null && parentIndex >= 0 && parentIndex < planSteps.length) 
            ? planSteps[parentIndex].id 
            : null;

          const result = await db.run(
            'INSERT INTO tasks (session_id, description, plan_order, status, parent_task_id) VALUES (?, ?, ?, ?, ?)',
            [sessionId, steps[i].description, i, 'pending', parentTaskId]
          );
          planSteps.push({
            id: result.lastID,
            description: steps[i].description,
            status: 'pending',
            plan_order: i,
            parent_task_id: parentTaskId
          });
        }

        logger.info({ sessionId, planId, steps: planSteps.length }, 'Plan created');
        return planSteps;
      }
    } catch (e: any) {
      logger.error({ error: e.message }, 'Failed to create plan');
    }

    // Fallback: create a single-step plan
    const result = await db.run(
      'INSERT INTO tasks (session_id, description, plan_order, status) VALUES (?, ?, ?, ?)',
      [sessionId, objective, 0, 'pending']
    );

    return [{
      id: result.lastID,
      description: objective,
      status: 'pending',
      plan_order: 0
    }];
  }

  async getPlan(sessionId: string): Promise<PlanStep[]> {
    const db = await getDb();
    const rows = await db.all(
      'SELECT id, description, status, plan_order, result, parent_task_id FROM tasks WHERE session_id = ? ORDER BY plan_order ASC',
      [sessionId]
    );
    return rows;
  }

  async updateTaskStatus(taskId: number, status: string, result?: string) {
    const db = await getDb();
    await db.run(
      'UPDATE tasks SET status = ?, result = ? WHERE id = ?',
      [status, result, taskId]
    );
  }

  async runTask(sessionId: string, task: string): Promise<string> {
    metrics.tasksStarted++;
    const startTime = Date.now();

    // Wall-clock timeout: race the actual work against a timer
    const timeoutMs = config.AGENT_TIMEOUT_MS;
    let timeoutHandle: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<string>(resolve => {
      timeoutHandle = setTimeout(() => {
        metrics.tasksTimedOut++;
        logger.warn({ sessionId, timeoutMs }, 'Agent task timed out');
        resolve(`Error: Task timed out after ${timeoutMs / 1000}s. Try breaking it into smaller steps.`);
      }, timeoutMs);
    });

    const workPromise = this._runTaskInner(sessionId, task);

    const result = await Promise.race([workPromise, timeoutPromise]);
    clearTimeout(timeoutHandle!);

    const durationMs = Date.now() - startTime;
    if (result.startsWith('Error:')) {
      metrics.tasksFailed++;
    } else {
      metrics.tasksCompleted++;
      metrics.totalDurationMs += durationMs;
    }
    logger.info({ sessionId, durationMs }, 'Task finished');

    // Agent Bin logging
    try {
      const fs = require('fs');
      const path = require('path');
      const binDir = path.resolve(process.cwd(), config.WORKSPACE_DIR, 'Agent bin');
      if (!fs.existsSync(binDir)) {
        fs.mkdirSync(binDir, { recursive: true });
      }
      const logContent = `\n\n=== TASK (${new Date().toISOString()}) ===\nSession: ${sessionId}\nTask: ${task}\n\nResult:\n${result}\n`;
      fs.appendFileSync(path.join(binDir, 'agent_log.txt'), logContent, 'utf8');
    } catch (e: any) {
      logger.warn({ error: e.message }, 'Failed to write to Agent bin');
    }

    return result;
  }

  private async _runTaskInner(sessionId: string, task: string): Promise<string> {
    const db = await getDb();
    const { systemPrompt, history } = await buildContext(sessionId, task);

    let messages = [
      { role: 'user', parts: [{ text: systemPrompt }] },
      ...history
    ];

    let iterations = 0;
    const maxIterations = 15;

    // Track current task for plan mode
    let currentTaskId: number | null = null;

    while (iterations < maxIterations) {
      iterations++;
      logger.info({ sessionId, iteration: iterations }, 'Agent iteration');

      const response = await this.llm.chat(messages);
      messages.push({ role: 'model', parts: [{ text: response }] });
      await db.run('INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)', [sessionId, 'assistant', response]);

      // Parse Action
      const actionMatch = response.match(/Action:\s*(\w+)/);
      const inputMatch = response.match(/Action Input:\s*({.*})/);

      if (actionMatch && inputMatch) {
        const toolName = actionMatch[1];
        let toolInput: any;

        try {
          toolInput = JSON.parse(inputMatch[1]);
        } catch (e: any) {
          const errorMsg = `Observation: Error parsing Action Input JSON: ${e.message}`;
          messages.push({ role: 'user', parts: [{ text: errorMsg }] });
          await db.run('INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)', [sessionId, 'user', errorMsg]);
          continue;
        }

        const tool = getToolByName(toolName);

        if (tool) {
          recordToolCall(toolName);
          logger.info({ toolName, toolInput }, 'Executing tool');
          try {
            let observation = await tool.forward(toolInput);
            
            // Truncate overly long tool outputs to prevent context bloat
            if (observation.length > 2000) {
              observation = observation.substring(0, 2000) + '\n...[TRUNCATED to 2000 chars for context limits]';
            }

            const observationMsg = `Observation: ${observation}`;
            messages.push({ role: 'user', parts: [{ text: observationMsg }] });
            await db.run('INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)', [sessionId, 'user', observationMsg]);

            // Check if this was a confirmation request that needs user action
            if (observation.includes('[CONFIRMATION REQUIRED]') || observation.includes('[WAITING FOR USER INPUT]')) {
              // Pause and wait for user confirmation
              return observation;
            }
          } catch (e: any) {
            const errorMsg = `Observation: Error executing tool: ${e.message}`;
            messages.push({ role: 'user', parts: [{ text: errorMsg }] });
            await db.run('INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)', [sessionId, 'user', errorMsg]);
          }
        } else {
          const errorMsg = `Observation: Tool "${toolName}" not found.`;
          messages.push({ role: 'user', parts: [{ text: errorMsg }] });
        }
      } else if (response.includes('Final Answer:')) {
        // Task completed
        if (currentTaskId) {
          await this.updateTaskStatus(currentTaskId, 'completed', response);
        }
        return response.split('Final Answer:')[1].trim();
      } else {
        // No action found, might be just thinking or a malformed response
        if (iterations === maxIterations) break;
        messages.push({ role: 'user', parts: [{ text: 'Please provide an Action or Final Answer.' }] });
      }
    }

    return "Max iterations reached without a final answer.";
  }

  async runWithPlan(sessionId: string, objective: string): Promise<string> {
    logger.info({ sessionId, objective }, 'Starting task with planning');

    // Create the plan
    const steps = await this.createPlan(sessionId, objective);
    logger.info({ steps: steps.length }, 'Plan created');

    // Store plan creation message
    const db = await getDb();
    await db.run('INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)', [
      sessionId,
      'assistant',
      `Plan created with ${steps.length} steps:\n${steps.map(s => `  ${s.plan_order + 1}. ${s.description}`).join('\n')}`
    ]);

    // Execute each step
    const results: string[] = [];
    for (const step of steps) {
      logger.info({ step: step.description }, 'Executing plan step');

      // Update task status
      if (step.id) {
        await this.updateTaskStatus(step.id, 'in_progress');
      }

      // Run the step
      const result = await this.runTask(sessionId, step.description);

      if (step.id) {
        await this.updateTaskStatus(step.id, result.includes('Error') ? 'failed' : 'completed', result);
      }

      results.push(`Step "${step.description}": ${result}`);

      // Check for user confirmation needed
      if (result.includes('[CONFIRMATION REQUIRED]') || result.includes('[WAITING FOR USER INPUT]')) {
        return `Plan paused. ${result}`;
      }
    }

    // Mark plan as completed
    await db.run('UPDATE plans SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE session_id = ?', ['completed', sessionId]);

    return `Plan completed.\n\nResults:\n${results.join('\n\n')}`;
  }

  /**
   * Execute multiple tool calls in parallel when they are independent.
   * Only read-only tools are safe for parallel execution.
   */
  async executeParallelToolCalls(
    sessionId: string,
    toolCalls: Array<{ toolName: string; input: any }>
  ): Promise<string> {
    const db = await getDb();

    // Filter to only parallel-safe tools
    const safeCalls = toolCalls.filter(call =>
      PARALLEL_SAFE_TOOLS.includes(call.toolName)
    );

    if (safeCalls.length === 0) {
      return 'No parallel-safe tools to execute.';
    }

    // Execute all safe tools concurrently
    const results = await Promise.allSettled(
      safeCalls.map(async (call) => {
        const tool = getToolByName(call.toolName);
        if (!tool) {
          return { toolName: call.toolName, result: `Tool not found: ${call.toolName}` };
        }
        try {
          const result = await tool.forward(call.input);
          return { toolName: call.toolName, result };
        } catch (e: any) {
          return { toolName: call.toolName, result: `Error: ${e.message}` };
        }
      })
    );

    // Format results
    const formattedResults = results
      .map(r => {
        if (r.status === 'fulfilled') {
          return `[${r.value.toolName}]:\n${r.value.result}`;
        }
        return `[Error]: ${r.reason}`;
      })
      .join('\n\n---\n\n');

    // Store in messages
    await db.run('INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)', [
      sessionId,
      'user',
      `Parallel tool execution results:\n${formattedResults}`
    ]);

    return formattedResults;
  }
}
