import path from 'path';
import fs from 'fs';
import { config } from '../config';

export interface ToolInput {
  [key: string]: any;
}

export abstract class Tool {
  abstract name: string;
  abstract description: string;
  abstract inputs: { [key: string]: { type: string; description: string; required?: boolean } };

  protected safeResolve(relativePath: string): string {
    const workspaceRoot = path.resolve(process.cwd(), config.WORKSPACE_DIR);
    const resolvedPath = path.resolve(workspaceRoot, relativePath);

    if (!resolvedPath.startsWith(workspaceRoot)) {
      throw new Error(`Permission Denied: Path escape attempted: ${relativePath}`);
    }

    return resolvedPath;
  }

  abstract forward(input: ToolInput): Promise<string>;
}
