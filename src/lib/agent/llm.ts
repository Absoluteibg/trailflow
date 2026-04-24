import { Ollama } from 'ollama';
import { config } from "../config";
import { logger } from "../logger";

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class OllamaLLM {
  private ollama: Ollama;

  constructor() {
    this.ollama = new Ollama({ host: config.OLLAMA_BASE_URL });
  }

  async chat(messages: any[], maxTokens: number = 2048, retries: number = 3): Promise<string> {
    const delays = [1000, 2000, 4000]; // Exponential backoff: 1s, 2s, 4s

    for (let i = 0; i < retries; i++) {
      try {
        // Map Gemini style messages to Ollama style messages
        const ollamaMessages = messages.map(m => {
          let content = '';
          if (Array.isArray(m.parts)) {
            content = m.parts.map((p: any) => p.text).join('\n');
          } else {
            content = m.content;
          }

          return {
            role: m.role === 'model' ? 'assistant' : m.role,
            content: content
          };
        });

        const response = await this.ollama.chat({
          model: config.OLLAMA_MODEL,
          messages: ollamaMessages,
          options: {
            temperature: 0.2,
            num_predict: maxTokens
          }
        });

        return response.message.content || '';
      } catch (error: any) {
        logger.warn({ error: error.message, attempt: i + 1, retries }, 'Ollama call failed, retrying...');
        if (i === retries - 1) {
          logger.error({ error: error.message }, 'Ollama call failed after all retries');
          throw error;
        }
        await sleep(delays[i]);
      }
    }

    throw new Error('Unexpected error in chat loop');
  }
}
