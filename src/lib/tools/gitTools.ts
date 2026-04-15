import simpleGit, { SimpleGit } from 'simple-git';
import { Tool, ToolInput } from './base';
import { config } from '../config';
import path from 'path';

export class GitStatusTool extends Tool {
  name = 'git_status';
  description = 'Get current git status of workspace repo.';
  inputs = {};

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

  async forward(input: ToolInput): Promise<string> {
    const workspaceRoot = path.resolve(process.cwd(), config.WORKSPACE_DIR);
    const git: SimpleGit = simpleGit(workspaceRoot);
    try {
      await git.add('.');
      const commit = await git.commit(input.message);
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

  async forward(input: ToolInput): Promise<string> {
    const workspaceRoot = path.resolve(process.cwd(), config.WORKSPACE_DIR);
    const git: SimpleGit = simpleGit(workspaceRoot);
    try {
      const diff = await git.diff(input.staged ? ['--staged'] : []);
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

  async forward(input: ToolInput): Promise<string> {
    const workspaceRoot = path.resolve(process.cwd(), config.WORKSPACE_DIR);
    const git: SimpleGit = simpleGit(workspaceRoot);
    
    const targetDir = input.directory ? this.safeResolve(input.directory) : workspaceRoot;
    const options = input.branch ? ['-b', input.branch] : [];

    try {
      await git.clone(input.url, targetDir, options);
      return `Successfully cloned ${input.url} into ${input.directory || 'workspace root'}`;
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

  async forward(input: ToolInput): Promise<string> {
    const workspaceRoot = path.resolve(process.cwd(), config.WORKSPACE_DIR);
    const git: SimpleGit = simpleGit(workspaceRoot);
    const remote = input.remote || 'origin';
    const branch = input.branch;

    try {
      const result = await git.push(remote, branch);
      return `Successfully pushed to ${remote} ${branch || ''}\nResult: ${JSON.stringify(result, null, 2)}`;
    } catch (e: any) {
      return `Error pushing to repository: ${e.message}`;
    }
  }
}
