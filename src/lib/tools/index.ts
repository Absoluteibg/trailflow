import { ReadFileTool, WriteFileTool, ListFilesTool, CreateDirTool, DeleteFileTool, EditFileTool } from './fileTools';
import { ShellExecTool, RunTestsTool } from './shellTools';
import { GitStatusTool, GitCommitTool, GitDiffTool, GitCloneTool, GitPushTool } from './gitTools';
import { SearchCodeTool } from './searchTools';
import { MemoryReadTool, MemoryWriteTool } from './memoryTools';
import { AskUserTool, ConfirmActionTool } from './interactionTools';
import { Tool } from './base';

export const allTools: Tool[] = [
  new ReadFileTool(),
  new WriteFileTool(),
  new ListFilesTool(),
  new CreateDirTool(),
  new DeleteFileTool(),
  new EditFileTool(),
  new ShellExecTool(),
  new RunTestsTool(),
  new GitStatusTool(),
  new GitCommitTool(),
  new GitDiffTool(),
  new GitCloneTool(),
  new GitPushTool(),
  new SearchCodeTool(),
  new MemoryReadTool(),
  new MemoryWriteTool(),
  new AskUserTool(),
  new ConfirmActionTool(),
];

export function getToolByName(name: string): Tool | undefined {
  return allTools.find(t => t.name === name);
}
