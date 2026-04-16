import { Ollama } from 'ollama';
import { config } from "../config";
import { logger } from "../logger";

export class OllamaLLM {
  private ollama: Ollama;

  constructor() {
    this.ollama = new Ollama({ host: config.OLLAMA_BASE_URL });
  }

  async chat(messages: any[], maxTokens: number = 2048): Promise<string> {
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
        model: "ollama/gemma4:e4b", // Hardcoded as requested
        messages: ollamaMessages,
        options: {
          temperature: 0.2,
          num_predict: maxTokens
        }
      });

      return response.message.content || '';
    } catch (error: any) {
      logger.error({ error: error.message }, 'Ollama Call failed');
      throw error;
    }
  }
}
