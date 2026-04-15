import { Command } from 'commander';
import { AgentRuntime } from './lib/agent/runtime';
import { logger } from './lib/logger';
import { config } from './lib/config';

const program = new Command();
const agent = new AgentRuntime();

program
  .name('trailflow')
  .description('Trailflow CLI - Autonomous AI coding agent')
  .version('0.1.0');

program
  .command('chat')
  .description('Send a message to the agent')
  .argument('<message>', 'The message to send')
  .option('-s, --session <id>', 'Session ID', `cli_${Date.now()}`)
  .action(async (message, options) => {
    try {
      const result = await agent.runTask(options.session, message);
      console.log(`\nTRAILFLOW RESULT:\n\n${result}`);
    } catch (e: any) {
      console.error(`Error: ${e.message}`);
    }
  });

program
  .command('task')
  .description('Run an autonomous coding task')
  .argument('<description>', 'Task description')
  .action(async (description) => {
    const sessionId = `task_${Date.now()}`;
    logger.info({ sessionId, description }, 'Starting autonomous task');
    const result = await agent.runTask(sessionId, description);
    console.log(`\nTASK COMPLETE:\n\n${result}`);
  });

program.parse();
