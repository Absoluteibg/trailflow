import { getDb } from "../db";
import { ListFilesTool } from "../tools/fileTools";
import { MemoryReadTool } from "../tools/memoryTools";
import { config } from "../config";

export async function buildContext(sessionId: string, task: string) {
  const db = await getDb();
  const listFiles = new ListFilesTool();
  const memoryRead = new MemoryReadTool();

  const fileTree = await listFiles.forward({ path: '.' });
  const memory = await memoryRead.forward({});
  const history = await db.all('SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at DESC LIMIT 10', [sessionId]);
  
  const systemPrompt = `You are Trailflow, a fully autonomous AI coding agent.
Your workspace is: ${config.WORKSPACE_DIR}

RULES:
- Always start by reading MEMORY.md to understand the project context.
- Break every task into clear, small steps before acting.
- Use tools to explore, write, edit, run, and test code.
- After making code changes, always run tests to verify correctness.
- After passing tests, commit your changes with a clear commit message.
- Update MEMORY.md with important decisions, bugs found, and completed tasks.
- Never ask for clarification unless a task is completely ambiguous.
- Always report what you did and what the outcome was at the end.

TOOLS:
You have access to the following tools. To use a tool, output a JSON block like this:
Thought: I need to list the files.
Action: list_files
Action Input: {"path": "."}
Observation: (tool output will appear here)

... repeat until task is done ...

Final Answer: (summary of work)

WORKSPACE STATE:
${fileTree}

RECENT MEMORY:
${memory || '(empty)'}

TASK:
${task}`;

  return {
    systemPrompt,
    history: history.reverse().map(h => ({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.content }] }))
  };
}
