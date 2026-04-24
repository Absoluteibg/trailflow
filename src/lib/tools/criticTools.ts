import { Tool, ToolInput } from './base';
import { z } from 'zod';
import { AgentRuntime } from '../agent/runtime';
import { getDb } from '../db';
import { logger } from '../logger';
import { RunTestsTool } from './shellTools';

const SelfReviewSchema = z.object({
  file_paths: z.array(z.string()).min(1, 'At least one file must be specified'),
  context: z.string().optional()
});

const AutoTestSchema = z.object({
  file_path: z.string().min(1, 'Target file path cannot be empty'),
  test_file_path: z.string().optional()
});

export class SelfReviewTool extends Tool {
  name = 'self_review';
  description = 'Spawn a critic sub-agent to review specific files for bugs, code smells, and security issues. Returns a review report with suggestions.';
  inputs = {
    file_paths: { type: 'array', description: 'List of relative file paths to review.', required: true },
    context: { type: 'string', description: 'Optional context about what changed.', required: false }
  };
  protected schema = SelfReviewSchema;

  async forward(input: ToolInput): Promise<string> {
    const validation = this.validateInput(input);
    if (!validation.valid) return `Error: Invalid input - ${validation.error}`;

    const files = validation.data.file_paths.join(', ');
    const context = validation.data.context;

    const task = `Act as a senior code reviewer. Review the following files for potential bugs, security issues, performance problems, and code smells. Files to review: ${files}. Provide a strict, bulleted review report. If there are no issues, just state 'Review passed'.`;
    
    let fullPrompt = task;
    if (context) {
      fullPrompt = `[Context]\n${context}\n\n[Your Task]\n${task}`;
    }

    const reviewId = `review_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    logger.info({ reviewId, files }, 'Spawning critic agent');

    const db = await getDb();
    await db.run('INSERT OR IGNORE INTO sessions (id) VALUES (?)', [reviewId]);
    await db.run('INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)', [reviewId, 'user', fullPrompt]);

    const agent = new AgentRuntime();
    
    try {
      const result = await agent.runTask(reviewId, fullPrompt);
      return `Critic Review Result:\n${result}`;
    } catch (e: any) {
      return `Critic review failed with error: ${e.message}`;
    }
  }
}

export class AutoTestTool extends Tool {
  name = 'auto_test';
  description = 'Auto-generate a test suite for a given file and run it. Useful for Test-Driven Development loops.';
  inputs = {
    file_path: { type: 'string', description: 'File to test.', required: true },
    test_file_path: { type: 'string', description: 'Path to generate the test file at (optional).', required: false }
  };
  protected schema = AutoTestSchema;

  async forward(input: ToolInput): Promise<string> {
    const validation = this.validateInput(input);
    if (!validation.valid) return `Error: Invalid input - ${validation.error}`;

    const file = validation.data.file_path;
    const testFile = validation.data.test_file_path || file.replace(/\.([jt]sx?)$/, '.test.$1');

    const task = `Read the file ${file} and generate a comprehensive unit test suite using vitest/jest syntax. Save the output to ${testFile}. Only output the code, and then run tests using npm test.`;

    const testId = `autotest_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    logger.info({ testId, file }, 'Spawning autotest agent');

    const db = await getDb();
    await db.run('INSERT OR IGNORE INTO sessions (id) VALUES (?)', [testId]);
    await db.run('INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)', [testId, 'user', task]);

    const agent = new AgentRuntime();
    
    try {
      const result = await agent.runTask(testId, task);
      
      // Also trigger a run tests to confirm
      const runner = new RunTestsTool();
      const testResult = await runner.forward({ path: '.', extra_args: '' });

      return `Auto-Test Agent completed.\n\nAgent Output:\n${result}\n\nTest Runner Result:\n${testResult}`;
    } catch (e: any) {
      return `Auto-test failed with error: ${e.message}`;
    }
  }
}
