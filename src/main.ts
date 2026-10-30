import * as dotenv from 'dotenv';
import { promises as fs } from 'fs';
import * as path from 'path';
import { CodeReviewOrchestrator } from './orchestrator';
import { ReportGenerator } from './utils/report-generator';
import { logger } from './utils/logger';

// Load environment variables
dotenv.config();

/**
 * Main entry point for the Claude Multi-Agent Code Review System
 * Usage: npm run dev <owner> <repo> <pr-number>
 */
async function main() {
  const [owner, repo, prStr] = process.argv.slice(2);

  // Validate command line arguments
  if (!owner || !repo || !prStr) {
    console.error('❌ Error: Missing required arguments\n');
    console.error('Usage:');
    console.error('  npm run dev <owner> <repo> <pr-number>');
    console.error('  npm start <owner> <repo> <pr-number>\n');
    console.error('Arguments:');
    console.error('  owner      - GitHub repository owner (username or organization)');
    console.error('  repo       - GitHub repository name');
    console.error('  pr-number  - Pull request number (must be a positive integer)\n');
    console.error('Examples:');
    console.error('  npm run dev facebook react 12345');
    console.error('  npm run dev microsoft typescript 54321');
    console.error('  npm start openai gpt-4 98765\n');
    process.exit(1);
  }

  const prNumber = parseInt(prStr, 10);
  if (isNaN(prNumber) || prNumber <= 0) {
    console.error(`❌ Error: Invalid PR number "${prStr}"`);
    console.error('The PR number must be a positive integer (e.g., 12345)\n');
    process.exit(1);
  }

  // Validate authentication
  const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
  const hasAWSCredentials = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);

  if (hasAWSCredentials) {
    if (!process.env.AWS_REGION) {
      console.error('Error: AWS_REGION is required when using AWS Bedrock authentication');
      process.exit(1);
    }
    console.log('🔐 Using AWS Bedrock authentication');
  } else if (hasAnthropicKey) {
    console.log('🔐 Using Anthropic API authentication');
  } else {
    console.error('Error: No authentication configured');
    console.error('');
    console.error('Please configure ONE of the following:');
    console.error('');
    console.error('Option 1 - Anthropic API:');
    console.error('  Set ANTHROPIC_API_KEY=sk-ant-your-key-here');
    console.error('');
    console.error('Option 2 - AWS Bedrock:');
    console.error('  Set AWS_ACCESS_KEY_ID=your-access-key');
    console.error('  Set AWS_SECRET_ACCESS_KEY=your-secret-key');
    console.error('  Set AWS_REGION=us-east-1 (or your preferred region)');
    process.exit(1);
  }

  // Validate ANTHROPIC_MODEL environment variable
  if (!process.env.ANTHROPIC_MODEL) {
    console.error('Error: ANTHROPIC_MODEL environment variable is required');
    console.error('');
    console.error('For Anthropic API:');
    console.error('  ANTHROPIC_MODEL=claude-sonnet-4-5-20250929');
    console.error('');
    console.error('For AWS Bedrock:');
    console.error('  ANTHROPIC_MODEL=us.anthropic.claude-sonnet-4-5-20250929-v1:0');
    process.exit(1);
  }

  // Warn if GITHUB_TOKEN is missing
  if (!process.env.GITHUB_TOKEN) {
    console.warn('⚠️  Warning: GITHUB_TOKEN not set');
    console.warn('   GitHub API rate limits will be restricted');
    console.warn('   Private repositories will not be accessible');
    console.warn('   Generate token at: https://github.com/settings/tokens\n');
  }

  console.log(`\n🔍 Reviewing PR #${prNumber} in ${owner}/${repo}...\n`);

  try {
    // Create orchestrator instance
    const orchestrator = new CodeReviewOrchestrator({
      model: process.env.ANTHROPIC_MODEL
    });

    // Review the pull request
    const report = await orchestrator.reviewPullRequest(owner, repo, prNumber);

    // Generate reports
    const reportGenerator = new ReportGenerator();
    const reportsDir = path.join(process.cwd(), 'reports');

    // Ensure reports directory exists
    await fs.mkdir(reportsDir, { recursive: true });

    // Generate and save Markdown report
    const markdownReport = reportGenerator.generateMarkdownReport(report);
    const markdownPath = path.join(reportsDir, `${owner}_${repo}_${prNumber}.md`);
    await fs.writeFile(markdownPath, markdownReport, 'utf-8');
    console.log(`✅ Markdown report saved: ${markdownPath}`);

    // Generate and save HTML report
    const htmlReport = reportGenerator.generateHTMLReport(report);
    const htmlPath = path.join(reportsDir, `${owner}_${repo}_${prNumber}.html`);
    await fs.writeFile(htmlPath, htmlReport, 'utf-8');
    console.log(`✅ HTML report saved: ${htmlPath}`);

    // Generate and save JSON report
    const jsonReport = reportGenerator.generateJSONReport(report);
    const jsonPath = path.join(reportsDir, `${owner}_${repo}_${prNumber}.json`);
    await fs.writeFile(jsonPath, jsonReport, 'utf-8');
    console.log(`✅ JSON report saved: ${jsonPath}`);

    console.log(`\n📊 Review Summary:`);
    console.log(`   Overall Score: ${report.summary.overallScore}/100`);
    console.log(`   Files Reviewed: ${report.summary.totalFiles}`);
    console.log(`   Critical Issues: ${report.summary.criticalIssues}`);
    console.log(`   High Priority Tests: ${report.summary.highPriorityTests}`);
    console.log(`   Refactoring Opportunities: ${report.summary.refactoringOpportunities}`);
    console.log('');

    logger.info('Review completed successfully', {
      owner,
      repo,
      prNumber,
      score: report.summary.overallScore
    });

  } catch (error) {
    console.error('\n❌ Error during review:');
    console.error(error);
    logger.error('Review failed', { error });
    process.exit(1);
  }
}

main();
