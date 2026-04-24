import { getDb } from "../db";
import { ListFilesTool } from "../tools/fileTools";
import { MemoryReadTool } from "../tools/memoryTools";
import { config } from "../config";
import { Ollama } from "ollama";

// Message importance scores for intelligent truncation
enum Importance {
  CRITICAL = 3,    // Tool executions, final answers, decisions
  HIGH = 2,        // User task definitions, important observations
  LOW = 1          // Intermediate thinking, partial results
}

interface ScoredMessage {
  id?: number;
  role: string;
  content: string;
  created_at: string;
  importance: Importance;
}

function scoreMessage(content: string, role: string): Importance {
  const lowerContent = content.toLowerCase();

  // CRITICAL: Tool executions and results
  if (content.includes('Action:') || content.includes('Observation:')) {
    return Importance.CRITICAL;
  }
  if (content.includes('Final Answer:') || content.includes('Successfully')) {
    return Importance.CRITICAL;
  }
  if (content.includes('[CONFIRMATION REQUIRED]') || content.includes('[WAITING FOR USER INPUT]')) {
    return Importance.CRITICAL;
  }

  // HIGH: User tasks, errors, important state
  if (role === 'user' && !content.startsWith('Observation:')) {
    return Importance.HIGH;
  }
  if (content.includes('Error:') || content.includes('ERROR:')) {
    return Importance.HIGH;
  }
  if (content.includes('git') || content.includes('commit') || content.includes('test')) {
    return Importance.HIGH;
  }

  // LOW: Everything else (thinking, partial results)
  return Importance.LOW;
}

async function summarizeMessages(messages: Array<{ role: string; content: string }>, ollama: Ollama): Promise<string> {
  const conversationText = messages
    .map(m => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`)
    .join('\n\n');

  const prompt = `Summarize the following conversation in 2-3 sentences. Focus on:
1. What task was requested
2. What actions were taken
3. What was accomplished

Conversation:
${conversationText}

Summary:`;

  try {
    const response = await ollama.chat({
      model: config.OLLAMA_MODEL,
      messages: [{ role: 'user', content: prompt }],
      options: {
        temperature: 0.3,
        num_predict: 200
      }
    });
    return response.message.content || 'Conversation summary unavailable.';
  } catch (e: any) {
    console.error('Summarization failed:', e.message);
    return 'Conversation summary unavailable due to error.';
  }
}

export async function buildContext(sessionId: string, task: string) {
  const db = await getDb();
  const listFiles = new ListFilesTool();
  const memoryRead = new MemoryReadTool();
  const ollama = new Ollama({ host: config.OLLAMA_BASE_URL });

  const fileTree = await listFiles.forward({ path: '.' });
  const memory = await memoryRead.forward({});

  // Fetch all messages with timestamps
  const allMessages = await db.all(
    'SELECT id, role, content, created_at FROM messages WHERE session_id = ? ORDER BY created_at ASC',
    [sessionId]
  );

  // Score messages by importance
  const scoredMessages: ScoredMessage[] = allMessages.map(msg => ({
    ...msg,
    importance: scoreMessage(msg.content, msg.role)
  }));

  // Calculate total token estimate (rough: 1 char ≈ 0.5 tokens)
  const totalChars = scoredMessages.reduce((sum, m) => sum + m.content.length, 0);
  const estimatedTokens = totalChars / 2;

  // Context window limits (for gemma4:4b, assume ~8k context, reserve 4k for response)
  const MAX_TOKENS = 4000;
  const NEEDS_TRIMMING = estimatedTokens > MAX_TOKENS;

  let history: Array<{ role: string; parts: Array<{ text: string }> }> = [];

  if (NEEDS_TRIMMING) {
    // Sort by importance (descending) and recency
    const sorted = [...scoredMessages].sort((a, b) => {
      if (b.importance !== a.importance) return b.importance - a.importance;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    // Take messages until we hit token limit
    let charCount = 0;
    const selected: ScoredMessage[] = [];

    for (const msg of sorted) {
      const msgChars = msg.content.length;
      if (charCount + msgChars <= MAX_TOKENS * 2) {
        selected.push(msg);
        charCount += msgChars;
      }
    }

    // Always include the most recent messages (last 2)
    const recentMessages = scoredMessages.slice(-2);
    for (const recent of recentMessages) {
      if (!selected.find(s => s.id === recent.id)) {
        selected.push(recent);
      }
    }

    // Restore chronological order
    selected.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    // Check if we still need summarization
    if (selected.length > 10) {
      // Summarize the oldest messages, keep recent ones intact
      const summarizeCount = Math.floor(selected.length / 2);
      const toSummarize = selected.slice(0, summarizeCount);
      const toKeep = selected.slice(summarizeCount);

      const summary = await summarizeMessages(
        toSummarize.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
        ollama
      );

      // Build history with summary at the start
      history = [
        { role: 'system', parts: [{ text: `[Conversation Summary]\n${summary}` }] },
        ...toKeep.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }))
      ];
    } else {
      history = selected.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));
    }
  } else {
    // No trimming needed - use simple recent messages approach but with larger window
    const recentMessages = await db.all(
      'SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at DESC LIMIT 20',
      [sessionId]
    );
    history = recentMessages.reverse().map(h => ({
      role: h.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: h.content }]
    }));
  }

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
- For destructive operations (rm, git reset --hard, delete), use confirm=true.

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
    history
  };
}
