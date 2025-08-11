# GitHub Agent Copilot Instructions

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# GitHub Agent Copilot Instructions

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

## Project Overview
This is a production-ready GitHub automation agent that acts as a fullstack developer. The agent:
- Listens to GitHub webhook events for issues and comments
- Uses AI-powered analysis for intelligent code generation
- Automatically implements complete Spring Boot solutions
- Creates branches and pull requests with detailed implementations
- Provides robust fallback systems and error handling

## Current Architecture
- **Express.js server** with TypeScript for webhook handling and API endpoints
- **Multi-provider AI integration** using FreeAIService (Claude Sonnet 4, Google Gemini, Ollama, Hugging Face)
- **GitHub API integration** using @octokit/rest and @octokit/webhooks
- **Git operations** using simple-git for repository management
- **Documentation-aware AI** that reads project context for better code generation

## Key Components
- `GitHubAgent`: Core automation logic with AI-enhanced issue processing
- `FreeAIService`: Multi-provider AI service with intelligent fallback system
- `WebhookHandler`: GitHub webhook event processing and routing
- `index.ts`: Express server entry point with health checks

## Development Guidelines
- Follow TypeScript best practices with strict type checking enabled
- Use async/await for all asynchronous operations with proper error handling
- Implement comprehensive logging for debugging and monitoring
- Follow RESTful API conventions for endpoints
- Use environment variables for all configuration (GitHub tokens, AI API keys, etc.)
- Maintain clear separation of concerns between components
- Ensure all AI operations have fallback mechanisms when services are unavailable
- Write clean, maintainable code with proper documentation
- Handle timeouts gracefully (AI operations have 10-minute timeout)
- Follow existing project patterns and conventions

## AI Integration Guidelines
- Always provide fallback templates when AI services are unavailable
- Use project documentation (README, package.json) for context-aware generation
- Follow existing codebase patterns and naming conventions
- Generate complete, production-ready Spring Boot code
- Include proper JPA annotations, validation, and error handling
- Maintain consistency with existing project structure and packages

## Key Technologies
- **Runtime**: TypeScript/Node.js with Express.js
- **GitHub Integration**: @octokit/rest, @octokit/webhooks
- **Repository Operations**: simple-git
- **AI Services**: Ollama (local), Hugging Face API, Google Gemini
- **Configuration**: dotenv for environment management
- **Development**: nodemon with hot reloading

## Code Generation Patterns
When generating Java Spring Boot code:
- Use Jakarta EE annotations (not javax)
- Follow project package structure: `com.example.{project}.{layer}`
- Generate entities with proper JPA mappings and validation
- Create repositories extending JpaRepository with custom queries
- Implement services with business logic and CRUD operations
- Build REST controllers with proper HTTP methods and error handling
- Include comprehensive javadoc and inline comments

## Current Features
- **Multi-Provider AI**: Claude Sonnet 4 (primary), Google Gemini, Ollama (local), Hugging Face with automatic fallback
- **Intelligent Code Generation**: Complete Spring Boot applications (entities, repositories, services, controllers)
- **Documentation-Aware**: Reads README.md, copilot-instructions.md, and package.json for context
- **Extended Processing**: 10-minute timeout for complex AI analysis
- **Robust Error Handling**: Comprehensive fallback systems and error recovery
- **Workspace Management**: Automatic cleanup after issue processing
- **Pattern Recognition**: Follows existing project conventions and coding standards

## Issue Processing Workflow
1. **Webhook Reception**: GitHub issue events trigger processing
2. **Content Analysis**: AI analyzes title, body, labels, and project documentation
3. **Repository Management**: Clone/update target repository
4. **Branch Creation**: Create feature branch with sanitized naming
5. **AI Code Generation**: Generate complete Spring Boot components
6. **Implementation**: Create and organize generated files
7. **Git Operations**: Commit, push, and create pull request
8. **Notification**: Comment on issue with results and cleanup

## Supported Issue Types
- **Entity Creation**: `Add {Entity} entity` → Generates JPA entity with repository, service, controller
- **Feature Implementation**: `Implement {feature}` → Analyzes requirements and generates code
- **API Development**: `Create REST API for {resource}` → Full CRUD implementation
- **Bug Fixes**: `Fix {issue}` → Analyzes and implements solution

## Environment Configuration
- `GITHUB_TOKEN`: Personal access token with repo permissions
- `WEBHOOK_SECRET`: Webhook security secret
- `ANTHROPIC_API_KEY`: Claude Sonnet 4 API key (primary AI provider)
- `GOOGLE_API_KEY`: Optional Google Gemini API key
- `OLLAMA_URL`: Local Ollama service URL (http://localhost:11434)
- `OLLAMA_MODEL`: AI model name (codellama:7b, qwen2:0.5b)
- `HUGGINGFACE_API_KEY`: Optional HuggingFace API key
