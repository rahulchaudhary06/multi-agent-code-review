import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { CODE_QUALITY_ANALYZER_PROMPT } from '../prompts';

/**
 * Code Quality Analyzer Agent
 * Analyzes code for quality issues, anti-patterns, and best practices
 */
export const codeQualityAnalyzer: AgentDefinition = {
  description: 'Code Quality Analyzer - identifies code issues, anti-patterns, and best practices',
  prompt: CODE_QUALITY_ANALYZER_PROMPT,
  tools: ['Read', 'Grep', 'Glob', 'Skill'],
  model: 'inherit'
};
