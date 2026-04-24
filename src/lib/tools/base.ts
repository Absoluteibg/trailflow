import path from 'path';
import fs from 'fs';
import { config } from '../config';
import { z } from 'zod';

export interface ToolInput {
  [key: string]: any;
}

export abstract class Tool {
  abstract name: string;
  abstract description: string;
  abstract inputs: { [key: string]: { type: string; description: string; required?: boolean } };
  protected schema?: z.ZodSchema;

  protected safeResolve(relativePath: string): string {
    const workspaceRoot = path.resolve(process.cwd(), config.WORKSPACE_DIR);
    const resolvedPath = path.resolve(workspaceRoot, relativePath);

    if (!resolvedPath.startsWith(workspaceRoot)) {
      throw new Error(`Permission Denied: Path escape attempted: ${relativePath}`);
    }

    return resolvedPath;
  }

  protected validateInput(input: ToolInput): { valid: boolean; data?: any; error?: string } {
    if (!this.schema) {
      return { valid: true, data: input };
    }
    try {
      const validated = this.schema.parse(input);
      return { valid: true, data: validated };
    } catch (e: any) {
      return { valid: false, error: e.errors?.[0]?.message || e.message };
    }
  }

  abstract forward(input: ToolInput): Promise<string>;
}
