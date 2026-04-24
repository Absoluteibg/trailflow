import { Ollama } from 'ollama';
import { config } from "../config";
import { logger } from "../logger";

export interface LLMProvider {
  chat(messages: any[], maxTokens?: number, retries?: number): Promise<string>;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class OllamaProvider implements LLMProvider {
  private ollama: Ollama;

  constructor() {
    this.ollama = new Ollama({ host: config.OLLAMA_BASE_URL });
  }

  async chat(messages: any[], maxTokens: number = 2048, retries: number = 3): Promise<string> {
    const delays = [1000, 2000, 4000];

    for (let i = 0; i < retries; i++) {
      try {
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

// Stub for Gemini, Anthropic, OpenAI providers.
// In a full implementation, these would use their respective SDKs.
export class PlaceholderProvider implements LLMProvider {
  private name: string;
  constructor(name: string) {
    this.name = name;
  }
  async chat(messages: any[], maxTokens: number = 2048, retries: number = 3): Promise<string> {
    logger.info(`Using placeholder provider for ${this.name}`);
    return `[${this.name} response]: I am a placeholder for the actual API call.`;
  }
}

export class LLMRouter implements LLMProvider {
  private provider: LLMProvider;

  constructor() {
    const defaultProvider = config.DEFAULT_PROVIDER;
    
    if (defaultProvider === 'gemini' && config.GEMINI_API_KEY) {
      this.provider = new PlaceholderProvider('gemini');
    } else if (defaultProvider === 'anthropic' && config.ANTHROPIC_API_KEY) {
      this.provider = new PlaceholderProvider('anthropic');
    } else if (defaultProvider === 'openai' && config.OPENAI_API_KEY) {
      this.provider = new PlaceholderProvider('openai');
    } else {
      // Default to ollama if configured or as ultimate fallback
      this.provider = new OllamaProvider();
    }
    logger.info({ provider: defaultProvider }, 'LLM Router initialized');
  }

  // Allow dynamic routing based on task complexity later
  route(taskComplexity: 'simple' | 'complex'): LLMProvider {
    // Example logic: if complex, try to use Gemini/Claude if available, else Ollama
    return this.provider;
  }

  async chat(messages: any[], maxTokens: number = 2048, retries: number = 3): Promise<string> {
    return this.provider.chat(messages, maxTokens, retries);
  }
}
