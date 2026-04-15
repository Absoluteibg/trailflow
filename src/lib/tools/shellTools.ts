import { exec } from 'child_process';
import { promisify } from 'util';
import { Tool, ToolInput } from './base';
import { config } from '../config';
import path from 'path';

const execAsync = promisify(exec);

export class ShellExecTool extends Tool {
  name = 'shell_exec';
  description = 'Execute a shell command inside the workspace directory. Use for running tests, git commands, builds, and package installs. Returns stdout and stderr.';
  inputs = {
    command: { type: 'string', description: 'Command to execute.', required: true },
    timeout: { type: 'number', description: 'Timeout in seconds (default: 60)', required: false }
  };

  private blocklist = ['rm -rf /', 'sudo', 'chmod 777', 'curl | bash', ':(){ :|:& };:'];

  async forward(input: ToolInput): Promise<string> {
    const command = input.command;
    const timeout = (input.timeout || 60) * 1000;

    for (const blocked of this.blocklist) {
      if (command.includes(blocked)) {
        return `Error: Command contains blocked pattern: ${blocked}`;
      }
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

  async forward(input: ToolInput): Promise<string> {
    const shell = new ShellExecTool();
    const cmd = `npm test ${input.extra_args || ''}`;
    return shell.forward({ command: cmd });
  }
}
