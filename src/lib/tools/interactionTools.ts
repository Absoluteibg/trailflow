import { Tool, ToolInput } from './base';
import { z } from 'zod';

const AskUserSchema = z.object({
  question: z.string().min(1, 'Question cannot be empty'),
  options: z.array(z.string()).optional()
});

export class AskUserTool extends Tool {
  name = 'ask_user';
  description = 'Ask the user a clarifying question when the task is ambiguous or requires human input. Use this when you need more information before proceeding.';
  inputs = {
    question: { type: 'string', description: 'The question to ask the user.', required: true },
    options: { type: 'array', description: 'Optional list of suggested answer options.', required: false }
  };
  protected schema = AskUserSchema;

  async forward(input: ToolInput): Promise<string> {
    const validation = this.validateInput(input);
    if (!validation.valid) return `Error: Invalid input - ${validation.error}`;

    const question = validation.data.question;
    const options = validation.data.options;

    // Format the question for display
    let response = `[WAITING FOR USER INPUT]\nQuestion: ${question}`;
    if (options && options.length > 0) {
      response += `\nOptions:\n${options.map((o: string) => `  - ${o}`).join('\n')}`;
    }
    response += '\n\nPlease provide your answer in the next message.';

    return response;
  }
}

export class ConfirmActionTool extends Tool {
  name = 'confirm_action';
  description = 'Request explicit user confirmation before executing a potentially destructive or high-impact action. Use before: deleting files, running rm -rf, resetting git, dropping databases, or any action that cannot be easily undone.';
  inputs = {
    action: { type: 'string', description: 'Description of the action to be taken.', required: true },
    reason: { type: 'string', description: 'Why this action is necessary.', required: false },
    risk: { type: 'string', description: 'Risk level: low, medium, high', required: false }
  };
  protected schema = z.object({
    action: z.string().min(1),
    reason: z.string().optional(),
    risk: z.enum(['low', 'medium', 'high']).optional().default('medium')
  });

  async forward(input: ToolInput): Promise<string> {
    const validation = this.validateInput(input);
    if (!validation.valid) return `Error: Invalid input - ${validation.error}`;

    const { action, reason, risk } = validation.data;

    let response = `[CONFIRMATION REQUIRED]\n`;
    response += `Action: ${action}\n`;
    if (reason) response += `Reason: ${reason}\n`;
    response += `Risk Level: ${risk.toUpperCase()}\n\n`;
    response += `Reply with "confirm" to proceed or "cancel" to abort.`;

    return response;
  }
}
