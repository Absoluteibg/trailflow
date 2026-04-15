import fs from 'fs';
import path from 'path';
import { Tool, ToolInput } from './base';
import { config } from '../config';
import { glob } from 'glob';

export class SearchCodeTool extends Tool {
  name = 'search_code';
  description = 'Search for a string or regex pattern across all files in the workspace. Returns matching lines with file paths and line numbers.';
  inputs = {
    pattern: { type: 'string', description: 'Regex pattern to search for.', required: true },
    file_glob: { type: 'string', description: 'Glob pattern for files (default: **/*.{ts,js,tsx,jsx,py})', required: false }
  };

  async forward(input: ToolInput): Promise<string> {
    const workspaceRoot = path.resolve(process.cwd(), config.WORKSPACE_DIR);
    const fileGlob = input.file_glob || '**/*.{ts,js,tsx,jsx,py}';
    const regex = new RegExp(input.pattern, 'g');
    
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
