import simpleGit, { SimpleGit } from 'simple-git';
import { Tool, ToolInput } from './base';
import { config } from '../config';
import path from 'path';
import { z } from 'zod';

const GitStatusSchema = z.object({});

const GitCommitSchema = z.object({
  message: z.string().min(1, 'Commit message cannot be empty')
});

const GitDiffSchema = z.object({
  staged: z.boolean().optional().default(false)
});

const GitCloneSchema = z.object({
  url: z.string().url('Invalid repository URL'),
  directory: z.string().optional(),
  branch: z.string().optional()
});

const GitPushSchema = z.object({
  remote: z.string().optional().default('origin'),
  branch: z.string().optional()
});

export class GitStatusTool extends Tool {
  name = 'git_status';
  description = 'Get current git status of workspace repo.';
  inputs = {};
  protected schema = GitStatusSchema;

  async forward(input: ToolInput): Promise<string> {
    const workspaceRoot = path.resolve(process.cwd(), config.WORKSPACE_DIR);
    const git: SimpleGit = simpleGit(workspaceRoot);
    try {
      const status = await git.status();
      return JSON.stringify(status, null, 2);
    } catch (e: any) {
      return `Error: ${e.message}`;
    }
  }
}

export class GitCommitTool extends Tool {
  name = 'git_commit';
  description = 'Stage all changes in the workspace and create a git commit with the provided message.';
  inputs = {
    message: { type: 'string', description: 'Commit message.', required: true }
  };
  protected schema = GitCommitSchema;

  async forward(input: ToolInput): Promise<string> {
    const validation = this.validateInput(input);
    if (!validation.valid) return `Error: Invalid input - ${validation.error}`;

    const workspaceRoot = path.resolve(process.cwd(), config.WORKSPACE_DIR);
    const git: SimpleGit = simpleGit(workspaceRoot);
    try {
      await git.add('.');
      const commit = await git.commit(validation.data.message);
      return `Successfully committed: ${commit.commit}\nSummary: ${JSON.stringify(commit.summary)}`;
    } catch (e: any) {
      return `Error: ${e.message}`;
    }
  }
}

export class GitDiffTool extends Tool {
  name = 'git_diff';
  description = 'Show the current git diff for unstaged or staged changes.';
  inputs = {
    staged: { type: 'boolean', description: 'Show staged changes (default: false)', required: false }
  };
  protected schema = GitDiffSchema;

  async forward(input: ToolInput): Promise<string> {
    const validation = this.validateInput(input);
    if (!validation.valid) return `Error: Invalid input - ${validation.error}`;

    const workspaceRoot = path.resolve(process.cwd(), config.WORKSPACE_DIR);
    const git: SimpleGit = simpleGit(workspaceRoot);
    try {
      const diff = await git.diff(validation.data.staged ? ['--staged'] : []);
      return diff || '(no changes)';
    } catch (e: any) {
      return `Error: ${e.message}`;
    }
  }
}

export class GitCloneTool extends Tool {
  name = 'git_clone';
  description = 'Clone a git repository from a URL into the workspace.';
  inputs = {
    url: { type: 'string', description: 'Repository URL.', required: true },
    directory: { type: 'string', description: 'Target directory name (optional).', required: false },
    branch: { type: 'string', description: 'Branch name (optional).', required: false }
  };
  protected schema = GitCloneSchema;

  async forward(input: ToolInput): Promise<string> {
    const validation = this.validateInput(input);
    if (!validation.valid) return `Error: Invalid input - ${validation.error}`;

    const workspaceRoot = path.resolve(process.cwd(), config.WORKSPACE_DIR);
    const git: SimpleGit = simpleGit(workspaceRoot);

    const targetDir = validation.data.directory ? this.safeResolve(validation.data.directory) : workspaceRoot;
    const options = validation.data.branch ? ['-b', validation.data.branch] : [];

    try {
      await git.clone(validation.data.url, targetDir, options);
      return `Successfully cloned ${validation.data.url} into ${validation.data.directory || 'workspace root'}`;
    } catch (e: any) {
      return `Error cloning repository: ${e.message}`;
    }
  }
}

export class GitPushTool extends Tool {
  name = 'git_push';
  description = 'Push committed changes to a remote repository.';
  inputs = {
    remote: { type: 'string', description: 'Remote name (default: origin).', required: false },
    branch: { type: 'string', description: 'Branch name (default: current branch).', required: false }
  };
  protected schema = GitPushSchema;

  async forward(input: ToolInput): Promise<string> {
    const validation = this.validateInput(input);
    if (!validation.valid) return `Error: Invalid input - ${validation.error}`;

    const workspaceRoot = path.resolve(process.cwd(), config.WORKSPACE_DIR);
    const git: SimpleGit = simpleGit(workspaceRoot);
    const remote = validation.data.remote;
    const branch = validation.data.branch;

    try {
      const result = await git.push(remote, branch);
      return `Successfully pushed to ${remote} ${branch || ''}\nResult: ${JSON.stringify(result, null, 2)}`;
    } catch (e: any) {
      return `Error pushing to repository: ${e.message}`;
    }
  }
}
