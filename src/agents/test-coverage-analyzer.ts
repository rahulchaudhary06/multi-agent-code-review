import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { TEST_COVERAGE_ANALYZER_PROMPT } from '../prompts';

/**
 * Test Coverage Analyzer Agent
 * Evaluates test completeness and suggests missing test cases
 */
export const testCoverageAnalyzer: AgentDefinition = {
  description: 'Test Coverage Analyzer - evaluates test completeness and suggests missing test cases',
  prompt: TEST_COVERAGE_ANALYZER_PROMPT,
  tools: ['Read', 'Grep', 'Glob', 'Skill'],
  model: 'inherit'
};
