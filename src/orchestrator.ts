import { query, type AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { ReviewReport, ReviewReportSchema, ReviewReportJSONSchema } from './types/report-types';
import { codeQualityAnalyzer, testCoverageAnalyzer, refactoringSuggester } from './agents';
import { buildOrchestratorPrompt } from './prompts';
import { logger, logReviewStart, logReviewComplete, logReviewError } from './utils/logger';
import { mcpServersConfig } from './config/mcp.config';
import { withRetry, withTimeout, ReviewError, ErrorCodes } from './utils/error-handler';
import { globalRateLimiter } from './utils/rate-limiter';

/**
 * Orchestrator configuration options
 */
export interface OrchestratorOptions {
  model?: string;
}

/**
 * Generate messages for SDK input
 */
async function* generateMessages(userMessage: string) {
  yield {
    type: 'user' as const,
    message: { role: 'user' as const, content: userMessage },
    parent_tool_use_id: null,
    session_id: 'code-review-session',
  };
}

/**
 * Main Code Review Orchestrator
 * Coordinates subagents to analyze pull requests and generate comprehensive reports
 */
export class CodeReviewOrchestrator {
  private model: string;

  constructor(options: OrchestratorOptions = {}) {
    this.model = options.model || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929';
  }

  /**
   * Review a pull request using parallel subagent analysis
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param prNumber - Pull request number
   * @returns Complete review report
   */
  async reviewPullRequest(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<ReviewReport> {
    const startTime = Date.now();
    logReviewStart(owner, repo, prNumber);

    try {
      // Acquire rate limit slot
      await globalRateLimiter.acquire(10000); // Estimate 10k tokens for PR review

      // Define subagents
      const agents: Record<string, AgentDefinition> = {
        'code-quality-analyzer': codeQualityAnalyzer,
        'test-coverage-analyzer': testCoverageAnalyzer,
        'refactoring-suggester': refactoringSuggester
      };

      const orchestratorPrompt = buildOrchestratorPrompt(owner, repo, prNumber);

      // Run the query with timeout and retry
      const reviewOperation = async () => {
        return await withTimeout(
          async () => {
            for await (const message of query({
              prompt: generateMessages(orchestratorPrompt),
              options: {
                // Task tool for subagents + GitHub and ESLint MCP tools
                allowedTools: [
                  'Task',
                  'mcp__github',
                  'mcp__eslint'
                ],
                agents,
                model: this.model,
                outputFormat: {
                  type: 'json_schema',
                  schema: ReviewReportJSONSchema
                },
                mcpServers: mcpServersConfig,
                maxTurns: 60,
              }
            })) {
              if (message.type === 'result' && message.subtype === 'success' && message.structured_output) {
                const parseResult = ReviewReportSchema.safeParse(message.structured_output);

                if (!parseResult.success) {
                  logger.error('Failed to parse review report', {
                    error: parseResult.error,
                    output: message.structured_output
                  });
                  throw new ReviewError(
                    `Failed to parse review report: ${parseResult.error.message}`,
                    ErrorCodes.VALIDATION_FAILED,
                    { zodError: parseResult.error }
                  );
                }

                return parseResult.data;
              } else if (message.type === 'result') {
                throw new ReviewError(
                  `Review failed: ${message.subtype}`,
                  ErrorCodes.AGENT_FAILED
                );
              }
            }

            throw new ReviewError(
              'Failed to generate review report',
              ErrorCodes.AGENT_FAILED
            );
          },
          900000, // 15 minute timeout
          `PR review timed out for ${owner}/${repo}#${prNumber}`
        );
      };

      // Execute with retry logic (2 retries)
      const report = await withRetry(reviewOperation, 2, 2000);

      const duration = Date.now() - startTime;

      // Release rate limiter
      globalRateLimiter.release();

      logReviewComplete(owner, repo, prNumber, report.summary.overallScore, duration);

      return report;
    } catch (error) {
      // Release rate limiter on error
      globalRateLimiter.release();

      logReviewError(owner, repo, prNumber, error as Error);

      // Re-throw with appropriate error handling
      if (error instanceof ReviewError) {
        throw error;
      }

      throw new ReviewError(
        `Unexpected error during review: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCodes.UNKNOWN_ERROR,
        { originalError: error }
      );
    }
  }
}
