import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { REFACTORING_SUGGESTER_PROMPT } from '../prompts';

/**
 * Refactoring Suggester Agent
 * Recommends architectural improvements and refactoring opportunities
 */
export const refactoringSuggester: AgentDefinition = {
  description: 'Refactoring Suggester - recommends architectural improvements and refactoring opportunities',
  prompt: REFACTORING_SUGGESTER_PROMPT,
  tools: ['Read', 'Grep', 'Glob', 'Skill'],
  model: 'inherit'
};
