import { GoogleGenAI } from "@google/genai";
import { config } from "../config";
import { logger } from "../logger";

export class GeminiLLM {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });
  }

  async chat(messages: any[], maxTokens: number = 2048): Promise<string> {
    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: messages,
        config: {
          temperature: 0.2,
          // maxOutputTokens is handled by the model usually, but we can set it if needed
        }
      });

      return response.text || '';
    } catch (error: any) {
      logger.error({ error: error.message }, 'LLM Call failed');
      throw error;
    }
  }
}
