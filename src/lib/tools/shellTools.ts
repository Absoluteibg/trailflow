import { exec } from 'child_process';
import { promisify } from 'util';
import { Tool, ToolInput } from './base';
import { config } from '../config';
import path from 'path';
import { z } from 'zod';

const execAsync = promisify(exec);

const ShellExecSchema = z.object({
  command: z.string().min(1, 'Command cannot be empty'),
  timeout: z.number().min(1).max(300).optional().default(60),
  confirm: z.boolean().optional()
});

const RunTestsSchema = z.object({
  path: z.string().optional().default('.'),
  extra_args: z.string().optional().default('')
});

// Destructive patterns that require explicit confirmation
const destructivePatterns = [
  { pattern: /rm\s+(-[rf]+\s+)?\*/i, desc: 'rm with wildcards' },
  { pattern: /rm\s+(-[rf]+\s+)?\.\./i, desc: 'rm with parent directory reference' },
  { pattern: /git\s+reset\s+--hard/i, desc: 'git reset --hard' },
  { pattern: /git\s+clean\s+(-[fdx]+\s*)?(-[fdx]+\s*)?$/i, desc: 'git clean' },
  { pattern: /drop\s+table/i, desc: 'SQL DROP TABLE' },
  { pattern: /truncate\s+/i, desc: 'SQL TRUNCATE' },
];

export class ShellExecTool extends Tool {
  name = 'shell_exec';
  description = 'Execute a shell command inside the workspace directory. Use for running tests, git commands, builds, and package installs. Returns stdout and stderr.';
  inputs = {
    command: { type: 'string', description: 'Command to execute.', required: true },
    timeout: { type: 'number', description: 'Timeout in seconds (default: 60)', required: false },
    confirm: { type: 'boolean', description: 'Required for destructive commands.', required: false }
  };
  protected schema = ShellExecSchema;

  private allowlist = [
    'npm', 'npx', 'yarn', 'pnpm',
    'git',
    'node',
    'ls', 'dir',
    'cat', 'head', 'tail',
    'grep', 'find',
    'echo', 'printf',
    'mkdir', 'cp', 'mv',
    'pwd', 'whoami', 'date',
    'curl', 'wget',
    'docker', 'docker-compose',
    'ollama',
  ];

  private blocklist = ['rm -rf /', 'sudo', 'chmod 777', 'curl | bash', ':(){ :|:& };:', '>', '>>', '|'];

  private isDestructive(command: string): { isDestructive: boolean; reason?: string } {
    for (const { pattern, desc } of destructivePatterns) {
      if (pattern.test(command)) {
        return { isDestructive: true, reason: desc };
      }
    }
    return { isDestructive: false };
  }

  async forward(input: ToolInput): Promise<string> {
    const validation = this.validateInput(input);
    if (!validation.valid) return `Error: Invalid input - ${validation.error}`;

    const command = validation.data.command.trim();
    const timeout = validation.data.timeout * 1000;
    const confirm = validation.data.confirm;

    // Check blocklist first (hard denies)
    for (const blocked of this.blocklist) {
      if (command.includes(blocked)) {
        return `Error: Command contains blocked pattern: ${blocked}`;
      }
    }

    // Extract base command and check allowlist
    const baseCommand = command.split(/[ \t;|&]/)[0];
    if (!this.allowlist.includes(baseCommand)) {
      return `Error: Command not in allowlist: ${baseCommand}`;
    }

    // Check for destructive patterns
    const { isDestructive, reason } = this.isDestructive(command);
    if (isDestructive && !confirm) {
      return `[CONFIRMATION REQUIRED]\nDestructive command detected: ${reason}\nCommand: ${command}\n\nReply with confirm=true to execute.`;
    }

    const workspaceRoot = path.resolve(process.cwd(), config.WORKSPACE_DIR);

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: workspaceRoot,
        timeout: timeout,
      });
      return `STDOUT:\n${stdout}\n\nSTDERR:\n${stderr}`;
    } catch (error: any) {
      return `ERROR:\n${error.message}\n\nSTDOUT:\n${error.stdout}\n\nSTDERR:\n${error.stderr}`;
    }
  }
}

export class RunTestsTool extends Tool {
  name = 'run_tests';
  description = 'Run the test suite in the workspace using npm test or vitest. Returns pass/fail summary.';
  inputs = {
    path: { type: 'string', description: 'Subdirectory to run tests in (default: .)', required: false },
    extra_args: { type: 'string', description: 'Extra arguments for test runner.', required: false }
  };
  protected schema = RunTestsSchema;

  async forward(input: ToolInput): Promise<string> {
    const validation = this.validateInput(input);
    if (!validation.valid) return `Error: Invalid input - ${validation.error}`;

    const shell = new ShellExecTool();
    const cmd = `npm test ${validation.data.extra_args || ''}`;
    return shell.forward({ command: cmd });
  }
}
