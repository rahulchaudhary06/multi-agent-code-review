# Claude Multi-Agent Code Review System

An automated code review system powered by Claude AI that uses multiple specialized agents to analyze pull requests and generate comprehensive reports.

## Features

- **Multi-Agent Architecture**: Three specialized agents working in parallel
  - Code Quality Analyzer: Identifies issues, anti-patterns, and best practices
  - Test Coverage Analyzer: Evaluates test completeness and suggests improvements
  - Refactoring Suggester: Recommends code improvements and modernization

- **Comprehensive Reports**: Generates reports in three formats (Markdown, HTML, JSON)
- **MCP Integration**: Uses Model Context Protocol for GitHub and ESLint integration
- **Rate Limiting**: Token bucket algorithm to manage API usage
- **Retry Logic**: Automatic retry with exponential backoff for transient failures
- **Structured Output**: Type-safe reports validated with Zod schemas

## Prerequisites

- Node.js 18+ and npm
- Anthropic API key OR AWS Bedrock credentials
- (Optional) GitHub Personal Access Token for private repositories

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the project root:

```bash
# Required: Choose ONE authentication method

# Option 1: Anthropic API (Recommended)
ANTHROPIC_API_KEY=sk-ant-your-key-here
ANTHROPIC_MODEL=claude-sonnet-4-5-20250929

# Option 2: AWS Bedrock
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
ANTHROPIC_MODEL=us.anthropic.claude-sonnet-4-5-20250929-v1:0

# Optional: GitHub token for private repos and higher rate limits
GITHUB_TOKEN=ghp_your_token_here

# Project root path
PROJECT_ROOT=/path/to/project/starter
```

**Get your API keys:**
- Anthropic API: https://console.anthropic.com/settings/keys
- GitHub Token: https://github.com/settings/tokens

### 3. Build the Project

```bash
npm run build
```

### 4. Run Tests

```bash
npm test
```

## Usage

### Basic Command

```bash
npm run dev -- <owner> <repo> <pr-number>
```

### Examples

Review a public pull request:
```bash
npm run dev -- facebook react 12345
```

Review from a private repository (requires GITHUB_TOKEN):
```bash
npm run dev -- myorg myrepo 456
```

Using the production build:
```bash
npm start -- microsoft typescript 54321
```

### Command Arguments

- `owner`: GitHub repository owner (username or organization)
- `repo`: Repository name
- `pr-number`: Pull request number (must be a positive integer)

### Output

Reports are saved to the `reports/` directory:
- `{owner}_{repo}_{pr}.md` - Human-readable Markdown report
- `{owner}_{repo}_{pr}.html` - Styled HTML report
- `{owner}_{repo}_{pr}.json` - Structured JSON data

Example output:
```
📊 Review Summary:
   Overall Score: 87/100
   Files Reviewed: 1
   Critical Issues: 1
   High Priority Tests: 3
   Refactoring Opportunities: 8

✅ Markdown report saved: reports/udacity_cd14715-simple-todo-app_1.md
✅ HTML report saved: reports/udacity_cd14715-simple-todo-app_1.html
✅ JSON report saved: reports/udacity_cd14715-simple-todo-app_1.json
```

## Project Structure

```
project/starter/
├── src/
│   ├── agents/                 # Agent definitions
│   │   ├── code-quality-analyzer.ts
│   │   ├── test-coverage-analyzer.ts
│   │   └── refactoring-suggester.ts
│   ├── config/                 # Configuration
│   │   └── mcp.config.ts       # MCP server setup
│   ├── prompts/                # Agent prompts
│   │   ├── code-quality-analyzer.prompt.ts
│   │   ├── orchestrator.prompt.ts
│   │   ├── refactoring-suggester.prompt.ts
│   │   └── test-coverage-analyzer.prompt.ts
│   ├── types/                  # Type definitions
│   │   └── report-types.ts     # Zod schemas
│   ├── utils/                  # Utilities
│   │   ├── error-handler.ts    # Retry and timeout logic
│   │   ├── logger.ts           # Winston logger
│   │   ├── rate-limiter.ts     # Rate limiting
│   │   └── report-generator.ts # Report formatters
│   ├── main.ts                 # CLI entry point
│   └── orchestrator.ts         # Main orchestration logic
├── tests/                      # Test suite
│   └── orchestrator.test.ts
├── reports/                    # Generated reports
├── .env                        # Environment configuration
├── package.json
└── tsconfig.json
```

## Architecture

### Orchestrator Pattern

The `CodeReviewOrchestrator` coordinates three specialized agents that run in parallel:

1. **Fetch PR Data**: Uses GitHub MCP to retrieve pull request files and diffs
2. **Parallel Analysis**: Spawns three agents using the Task tool
3. **Aggregate Results**: Combines analyses into a structured report
4. **Validate Output**: Uses Zod schemas with safeParse for type safety

### Error Handling

- **Retry Logic**: Automatically retries failed operations (up to 2 retries)
- **Timeout Protection**: 15-minute timeout per review
- **Rate Limiting**: Prevents API quota exhaustion
- **Graceful Degradation**: Continues with partial results if one agent fails

### MCP Integration

The system uses Model Context Protocol servers for external data:
- **GitHub MCP**: Fetches PR data, file contents, and diffs
- **ESLint MCP**: Performs static code analysis

## Testing

Run the full test suite:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

Test coverage includes:
- Schema validation (valid, invalid, edge cases)
- JSON schema export
- Retry logic with backoff
- Timeout protection
- Rate limiter behavior
- Error handling

## Troubleshooting

### "ANTHROPIC_API_KEY not set"
Set your API key in the `.env` file or export it:
```bash
export ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### "GITHUB_TOKEN not set" Warning
This is optional for public repositories. For private repos or higher rate limits:
1. Generate token at https://github.com/settings/tokens
2. Add to `.env`: `GITHUB_TOKEN=ghp_your_token_here`

### "Invalid PR number"
Ensure the PR number is a positive integer and exists in the repository.

### Rate Limit Errors
The system includes automatic rate limiting, but you can:
- Reduce concurrent requests in `src/utils/rate-limiter.ts`
- Add delays between reviews
- Use a GitHub token for higher rate limits

### Review Timeout
For very large PRs, increase the timeout in `src/orchestrator.ts`:
```typescript
withTimeout(
  async () => { /* ... */ },
  900000, // 15 minutes (increase if needed)
  `PR review timed out`
);
```

## Development

### Adding New Agents

1. Create agent definition in `src/agents/your-agent.ts`
2. Add prompt in `src/prompts/your-agent.prompt.ts`
3. Update schema in `src/types/report-types.ts`
4. Register agent in `src/orchestrator.ts`

### Modifying Report Format

Edit the report generator methods in `src/utils/report-generator.ts`:
- `generateMarkdownReport()` - Markdown format
- `generateHTMLReport()` - HTML format
- `generateJSONReport()` - JSON format

## Key Technologies

- **Claude Agent SDK** - Multi-agent orchestration framework
- **Model Context Protocol (MCP)** - External data integration
- **Zod** - Schema validation and type safety
- **zod-to-json-schema** - Convert Zod schemas to JSON Schema
- **TypeScript** - Type-safe development
- **Vitest** - Testing framework
- **Winston** - Structured logging

## License

MIT

## Contributing

Contributions welcome! Please ensure all tests pass before submitting PRs.

## Support

For issues or questions, please file a GitHub issue or contact the development team.
