import { describe, it, expect, vi } from 'vitest';
import { CodeReviewOrchestrator } from '../src/orchestrator';
import { codeQualityAnalyzer, testCoverageAnalyzer, refactoringSuggester } from '../src/agents';
import {
  ReviewReportSchema,
  ReviewReportJSONSchema
} from '../src/types/report-types';
import {
  CodeQualityResultSchema,
  CodeQualityResultJSONSchema,
  TestCoverageResultSchema,
  TestCoverageResultJSONSchema,
  RefactoringSuggestionSchema,
  RefactoringSuggestionJSONSchema
} from '../src/types/analysis-results';
import { withRetry, withTimeout, ReviewError, ErrorCodes } from '../src/utils/error-handler';
import { RateLimiter } from '../src/utils/rate-limiter';

/**
 * Comprehensive tests for Code Review System
 */

describe('CodeReviewOrchestrator', () => {
  describe('Configuration', () => {
    it('should initialize with default options', () => {
      const orchestrator = new CodeReviewOrchestrator();
      expect(orchestrator).toBeDefined();
      expect(orchestrator).toBeInstanceOf(CodeReviewOrchestrator);
    });

    it('should accept custom model configuration', () => {
      const customModel = 'claude-haiku-4-5-20251001';
      const orchestrator = new CodeReviewOrchestrator({
        model: customModel
      });
      expect(orchestrator).toBeDefined();
      expect(orchestrator).toBeInstanceOf(CodeReviewOrchestrator);
    });
  });

  describe('Agent Definitions', () => {
    it('should have code quality analyzer with correct tools', () => {
      expect(codeQualityAnalyzer).toBeDefined();
      expect(codeQualityAnalyzer.description).toBeDefined();
      expect(codeQualityAnalyzer.prompt).toBeDefined();
      expect(codeQualityAnalyzer.tools).toContain('Read');
      expect(codeQualityAnalyzer.tools).toContain('Grep');
      expect(codeQualityAnalyzer.tools).toContain('Glob');
      expect(codeQualityAnalyzer.tools).toContain('Skill');
    });

    it('should have test coverage analyzer with correct tools', () => {
      expect(testCoverageAnalyzer).toBeDefined();
      expect(testCoverageAnalyzer.description).toBeDefined();
      expect(testCoverageAnalyzer.prompt).toBeDefined();
      expect(testCoverageAnalyzer.tools).toContain('Read');
      expect(testCoverageAnalyzer.tools).toContain('Grep');
      expect(testCoverageAnalyzer.tools).toContain('Glob');
      expect(testCoverageAnalyzer.tools).toContain('Skill');
    });

    it('should have refactoring suggester with correct tools', () => {
      expect(refactoringSuggester).toBeDefined();
      expect(refactoringSuggester.description).toBeDefined();
      expect(refactoringSuggester.prompt).toBeDefined();
      expect(refactoringSuggester.tools).toContain('Read');
      expect(refactoringSuggester.tools).toContain('Grep');
      expect(refactoringSuggester.tools).toContain('Glob');
      expect(refactoringSuggester.tools).toContain('Skill');
    });
  });

  describe('Schema Validation - Valid Cases', () => {
    it('should validate valid ReviewReport', () => {
      const validReport = {
        pullRequest: {
          owner: 'test-owner',
          repo: 'test-repo',
          number: 123
        },
        fileReviews: [],
        summary: {
          totalFiles: 0,
          overallScore: 100,
          criticalIssues: 0,
          highPriorityTests: 0,
          refactoringOpportunities: 0
        },
        recommendations: [],
        metadata: {
          analyzedAt: new Date().toISOString(),
          duration: 1000,
          agentVersions: {
            orchestrator: '1.0.0'
          }
        }
      };

      const result = ReviewReportSchema.safeParse(validReport);
      expect(result.success).toBe(true);
    });

    it('should validate valid CodeQualityResult', () => {
      const validResult = {
        file: 'src/main.ts',
        issues: [
          {
            line: 10,
            severity: 'high' as const,
            category: 'security' as const,
            description: 'Potential XSS vulnerability',
            suggestion: 'Sanitize user input'
          }
        ],
        overallScore: 85,
        summary: 'Found 1 security issue'
      };

      const result = CodeQualityResultSchema.safeParse(validResult);
      expect(result.success).toBe(true);
    });

    it('should validate valid TestCoverageResult', () => {
      const validResult = {
        file: 'src/utils.ts',
        hasTests: true,
        testFiles: ['tests/utils.test.ts'],
        untestedPaths: [
          {
            type: 'function' as const,
            location: 'calculateScore',
            priority: 'high' as const,
            reasoning: 'Core business logic',
            suggestedTest: 'Test edge cases for score calculation'
          }
        ],
        coverageEstimate: 75,
        summary: 'Good coverage with some gaps'
      };

      const result = TestCoverageResultSchema.safeParse(validResult);
      expect(result.success).toBe(true);
    });

    it('should validate valid RefactoringSuggestion', () => {
      const validResult = {
        file: 'src/legacy.ts',
        suggestions: [
          {
            type: 'modernize' as const,
            location: 'line 50',
            impact: 'medium' as const,
            description: 'Use async/await instead of callbacks',
            before: 'callback(err, data)',
            after: 'const data = await promise',
            benefits: 'Improved readability'
          }
        ],
        summary: '1 modernization opportunity'
      };

      const result = RefactoringSuggestionSchema.safeParse(validResult);
      expect(result.success).toBe(true);
    });
  });

  describe('Schema Validation - Invalid Cases', () => {
    it('should reject ReviewReport with invalid score', () => {
      const invalidReport = {
        pullRequest: { owner: 'test', repo: 'test', number: 1 },
        fileReviews: [],
        summary: {
          totalFiles: 0,
          overallScore: 150, // Invalid: > 100
          criticalIssues: 0,
          highPriorityTests: 0,
          refactoringOpportunities: 0
        },
        recommendations: [],
        metadata: {
          analyzedAt: new Date().toISOString(),
          duration: 1000,
          agentVersions: {}
        }
      };

      const result = ReviewReportSchema.safeParse(invalidReport);
      expect(result.success).toBe(false);
    });

    it('should reject CodeQualityResult with invalid severity', () => {
      const invalidResult = {
        file: 'test.ts',
        issues: [
          {
            line: 1,
            severity: 'extreme', // Invalid enum value
            category: 'security',
            description: 'test',
            suggestion: 'test'
          }
        ],
        overallScore: 50,
        summary: 'test'
      };

      const result = CodeQualityResultSchema.safeParse(invalidResult);
      expect(result.success).toBe(false);
    });

    it('should reject TestCoverageResult with missing required fields', () => {
      const invalidResult = {
        file: 'test.ts',
        hasTests: true,
        // Missing testFiles
        untestedPaths: [],
        coverageEstimate: 80
        // Missing summary
      };

      const result = TestCoverageResultSchema.safeParse(invalidResult);
      expect(result.success).toBe(false);
    });
  });

  describe('Schema Validation - Edge Cases', () => {
    it('should handle empty arrays in ReviewReport', () => {
      const report = {
        pullRequest: { owner: 'a', repo: 'b', number: 1 },
        fileReviews: [],
        summary: {
          totalFiles: 0,
          overallScore: 0,
          criticalIssues: 0,
          highPriorityTests: 0,
          refactoringOpportunities: 0
        },
        recommendations: [],
        metadata: {
          analyzedAt: new Date().toISOString(),
          duration: 0,
          agentVersions: {}
        }
      };

      const result = ReviewReportSchema.safeParse(report);
      expect(result.success).toBe(true);
    });

    it('should handle maximum score of 100', () => {
      const result = {
        file: 'perfect.ts',
        issues: [],
        overallScore: 100,
        summary: 'Perfect code'
      };

      const parseResult = CodeQualityResultSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });

    it('should handle minimum score of 0', () => {
      const result = {
        file: 'bad.ts',
        issues: [],
        overallScore: 0,
        summary: 'Needs work'
      };

      const parseResult = CodeQualityResultSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });
  });

  describe('JSON Schema Export', () => {
    it('should export ReviewReportJSONSchema as valid object', () => {
      expect(ReviewReportJSONSchema).toBeDefined();
      expect(typeof ReviewReportJSONSchema).toBe('object');
      expect(ReviewReportJSONSchema).toHaveProperty('type');
    });

    it('should export CodeQualityResultJSONSchema', () => {
      expect(CodeQualityResultJSONSchema).toBeDefined();
      expect(typeof CodeQualityResultJSONSchema).toBe('object');
    });

    it('should export TestCoverageResultJSONSchema', () => {
      expect(TestCoverageResultJSONSchema).toBeDefined();
      expect(typeof TestCoverageResultJSONSchema).toBe('object');
    });

    it('should export RefactoringSuggestionJSONSchema', () => {
      expect(RefactoringSuggestionJSONSchema).toBeDefined();
      expect(typeof RefactoringSuggestionJSONSchema).toBe('object');
    });
  });

  describe('Error Handler - Retry Logic', () => {
    it('should retry on failure and succeed eventually', async () => {
      let attempts = 0;
      const fn = async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Temporary failure');
        }
        return 'success';
      };

      const result = await withRetry(fn, 3, 100);
      expect(result).toBe('success');
      expect(attempts).toBe(2);
    });

    it('should throw ReviewError after max retries', async () => {
      const fn = async () => {
        throw new Error('Permanent failure');
      };

      await expect(withRetry(fn, 3, 100)).rejects.toThrow(ReviewError);
    });

    it('should apply exponential backoff', async () => {
      const startTime = Date.now();
      let attempts = 0;

      const fn = async () => {
        attempts++;
        throw new Error('Fail');
      };

      try {
        await withRetry(fn, 3, 100);
      } catch (e) {
        // Expected to fail
      }

      const duration = Date.now() - startTime;
      // Should take at least: 100ms + 200ms = 300ms (backoff delays between attempts)
      expect(duration).toBeGreaterThan(250);
      expect(attempts).toBe(3);
    });
  });

  describe('Error Handler - Timeout Logic', () => {
    it('should complete before timeout', async () => {
      const fn = async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'completed';
      };

      const result = await withTimeout(fn, 200);
      expect(result).toBe('completed');
    });

    it('should throw ReviewError on timeout', async () => {
      const fn = async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
        return 'too slow';
      };

      await expect(withTimeout(fn, 100, 'Timeout!')).rejects.toThrow(ReviewError);
      await expect(withTimeout(fn, 100, 'Timeout!')).rejects.toThrow('Timeout!');
    });

    it('should include timeout metadata in error', async () => {
      const fn = async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
      };

      try {
        await withTimeout(fn, 50);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ReviewError);
        if (error instanceof ReviewError) {
          expect(error.code).toBe(ErrorCodes.AGENT_TIMEOUT);
          expect(error.metadata?.timeoutMs).toBe(50);
        }
      }
    });
  });

  describe('Rate Limiter', () => {
    it('should allow request within limits', async () => {
      const limiter = new RateLimiter({
        maxRequestsPerMinute: 10,
        maxTokensPerMinute: 10000,
        maxConcurrent: 2
      });

      const canProceed = limiter.canProceed(1000);
      expect(canProceed).toBe(true);
    });

    it('should block when concurrent limit reached', async () => {
      const limiter = new RateLimiter({
        maxRequestsPerMinute: 10,
        maxTokensPerMinute: 10000,
        maxConcurrent: 1
      });

      // First acquire should succeed
      await limiter.acquire(100);

      // Second should not be able to proceed immediately
      const canProceed = limiter.canProceed(100);
      expect(canProceed).toBe(false);

      // Release should allow next request
      limiter.release();
      const canProceedNow = limiter.canProceed(100);
      expect(canProceedNow).toBe(true);
    });

    it('should track request history', async () => {
      const limiter = new RateLimiter({
        maxRequestsPerMinute: 5,
        maxTokensPerMinute: 10000,
        maxConcurrent: 5
      });

      await limiter.acquire(1000);
      limiter.release();

      const status = limiter.getStatus();
      expect(status.requestsInWindow).toBe(1);
      expect(status.tokensInWindow).toBe(1000);
    });

    it('should update with actual token count', async () => {
      const limiter = new RateLimiter({
        maxRequestsPerMinute: 10,
        maxTokensPerMinute: 10000,
        maxConcurrent: 2
      });

      await limiter.acquire(1000);
      limiter.release(500); // Actual was only 500

      const status = limiter.getStatus();
      expect(status.tokensInWindow).toBe(500);
    });

    it('should respect token limits', () => {
      const limiter = new RateLimiter({
        maxRequestsPerMinute: 100,
        maxTokensPerMinute: 1000,
        maxConcurrent: 10
      });

      // Request that would exceed token limit
      const canProceed = limiter.canProceed(2000);
      expect(canProceed).toBe(false);
    });
  });

  describe('Integration', () => {
    // These tests require actual API keys and should be skipped in CI
    it.skip('should review a real small PR', async () => {
      const orchestrator = new CodeReviewOrchestrator();
      const report = await orchestrator.reviewPullRequest('facebook', 'react', 12345);
      expect(report).toBeDefined();
      expect(report.pullRequest.owner).toBe('facebook');
      expect(report.pullRequest.repo).toBe('react');
      expect(report.pullRequest.number).toBe(12345);
    });
  });
});
