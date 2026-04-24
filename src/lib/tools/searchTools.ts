import fs from 'fs';
import path from 'path';
import { Tool, ToolInput } from './base';
import { config } from '../config';
import { glob } from 'glob';
import { z } from 'zod';

const SearchCodeSchema = z.object({
  pattern: z.string().min(1, 'Search pattern cannot be empty'),
  file_glob: z.string().optional().default('**/*.{ts,js,tsx,jsx,py}')
});

export class SearchCodeTool extends Tool {
  name = 'search_code';
  description = 'Search for a string or regex pattern across all files in the workspace. Returns matching lines with file paths and line numbers.';
  inputs = {
    pattern: { type: 'string', description: 'Regex pattern to search for.', required: true },
    file_glob: { type: 'string', description: 'Glob pattern for files (default: **/*.{ts,js,tsx,jsx,py})', required: false }
  };
  protected schema = SearchCodeSchema;

  async forward(input: ToolInput): Promise<string> {
    const validation = this.validateInput(input);
    if (!validation.valid) return `Error: Invalid input - ${validation.error}`;

    const workspaceRoot = path.resolve(process.cwd(), config.WORKSPACE_DIR);
    const fileGlob = validation.data.file_glob;

    let regex: RegExp;
    try {
      regex = new RegExp(validation.data.pattern, 'g');
    } catch (e: any) {
      return `Error: Invalid regex pattern - ${e.message}`;
    }

    const files = await glob(fileGlob, { cwd: workspaceRoot, absolute: true, nodir: true });
    let results = '';
    let matchCount = 0;

    for (const file of files) {
      if (matchCount >= 200) break;
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        if (regex.test(line)) {
          matchCount++;
          const relPath = path.relative(workspaceRoot, file);
          results += `${relPath}:${index + 1}: ${line.trim()}\n`;
        }
      });
    }

    return results || 'No matches found.';
  }
}
