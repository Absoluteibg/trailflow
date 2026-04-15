import { GeminiLLM } from "./llm";
import { buildContext } from "./context";
import { getToolByName } from "../tools";
import { getDb } from "../db";
import { logger } from "../logger";

export class AgentRuntime {
  private llm: GeminiLLM;

  constructor() {
    this.llm = new GeminiLLM();
  }

  async runTask(sessionId: string, task: string): Promise<string> {
    const db = await getDb();
    const { systemPrompt, history } = await buildContext(sessionId, task);
    
    let messages = [
      { role: 'user', parts: [{ text: systemPrompt }] },
      ...history
    ];

    let iterations = 0;
    const maxIterations = 15;

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
        const toolInput = JSON.parse(inputMatch[1]);
        const tool = getToolByName(toolName);

        if (tool) {
          logger.info({ toolName, toolInput }, 'Executing tool');
          try {
            const observation = await tool.forward(toolInput);
            const observationMsg = `Observation: ${observation}`;
            messages.push({ role: 'user', parts: [{ text: observationMsg }] });
            await db.run('INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)', [sessionId, 'user', observationMsg]);
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
        return response.split('Final Answer:')[1].trim();
      } else {
        // No action found, might be just thinking or a malformed response
        if (iterations === maxIterations) break;
        messages.push({ role: 'user', parts: [{ text: 'Please provide an Action or Final Answer.' }] });
      }
    }

    return "Max iterations reached without a final answer.";
  }
}
