# GitHub Agent Copilot Instructions

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

## Project Overview
This is a production-ready GitHub automation agent that acts as a fullstack developer. The agent:
- Listens to GitHub webhook events for issues and comments
- Uses AI-powered analysis for intelligent code generation with Claude Sonnet 4 as primary provider
- Automatically implements complete Spring Boot solutions
- Creates branches and pull requests with detailed implementations
- Provides robust fallback systems and comprehensive error handling
- Supports multiple AI providers with intelligent fallback mechanisms

## Current Architecture
- **Express.js server** with TypeScript for webhook handling and API endpoints
- **Multi-provider AI integration** using FreeAIService with Claude Sonnet 4 as primary, Google Gemini, Ollama, Hugging Face
- **GitHub API integration** using @octokit/rest and @octokit/webhooks for webhook processing
- **Git operations** using simple-git for repository management and branch operations
- **Documentation-aware AI** that reads project context (README, package.json, copilot-instructions) for better code generation
- **Comprehensive error handling** with timeout management and graceful fallbacks

## Key Components
- `GitHubAgent`: Core automation logic with AI-enhanced issue processing and repository management
- `FreeAIService`: Multi-provider AI service with intelligent fallback system (Claude → Gemini → Ollama → HuggingFace → Templates)
- `WebhookHandler`: GitHub webhook event processing, signature validation, and routing
- `index.ts`: Express server entry point with health checks and webhook endpoints

## Development Guidelines
- Follow TypeScript best practices with strict type checking enabled
- Use async/await for all asynchronous operations with comprehensive error handling
- Implement detailed logging for debugging and monitoring (console.log with structured data)
- Follow RESTful API conventions for endpoints with proper HTTP status codes
- Use environment variables for all configuration (GitHub tokens, AI API keys, service URLs, etc.)
- Maintain clear separation of concerns between components with single responsibility principle
- Ensure all AI operations have graceful fallback mechanisms when services are unavailable
- Write clean, maintainable code with comprehensive JSDoc documentation
- Handle timeouts gracefully (default 10-minute timeout for AI operations)
- Follow existing project patterns and conventions for consistency
- Implement proper error recovery and user-friendly error messages

## AI Integration Guidelines
- **Primary Provider**: Claude Sonnet 4 (Anthropic API) for highest quality code generation
- **Fallback Chain**: Google Gemini → Ollama (local) → Hugging Face → Template fallback
- Always provide functional template fallbacks when all AI services are unavailable
- Use project documentation (README, package.json, copilot-instructions) for context-aware generation
- Follow existing codebase patterns and naming conventions consistently
- Generate complete, production-ready Spring Boot code with proper structure
- Include proper JPA annotations, validation, error handling, and security considerations
- Maintain consistency with existing project structure and package organization
- Provide comprehensive code comments and documentation
- Ensure generated code follows Java/Spring Boot best practices

## Key Technologies
- **Runtime**: TypeScript/Node.js with Express.js framework
- **GitHub Integration**: @octokit/rest (REST API), @octokit/webhooks (webhook handling)
- **Repository Operations**: simple-git for Git operations and branch management
- **AI Services**: 
  - Claude Sonnet 4 (Anthropic API) - Primary provider for highest quality
  - Google Gemini - Secondary provider with generous free tier
  - Ollama (local) - Offline AI capability with models like codellama:7b, qwen2:0.5b
  - Hugging Face API - Additional fallback with free tier
- **Configuration**: dotenv for environment variable management
- **Development**: nodemon with hot reloading and ts-node for TypeScript execution

## Code Generation Patterns
When generating Java Spring Boot code:
- Use Jakarta EE annotations (not javax) for modern Spring Boot compatibility
- Follow project package structure: `com.example.{project}.{layer}` (e.g., com.example.employee.controller)
- Generate entities with proper JPA mappings (@Entity, @Table, @Id, @GeneratedValue) and validation (@NotNull, @Size, etc.)
- Create repositories extending JpaRepository<Entity, ID> with custom query methods using @Query annotations
- Implement services with business logic, CRUD operations, and proper exception handling
- Build REST controllers with proper HTTP methods (@GetMapping, @PostMapping, etc.) and error handling
- Include comprehensive JavaDoc documentation and inline comments for maintainability
- Follow RESTful API design principles with proper HTTP status codes
- Implement proper request/response DTOs when needed
- Add appropriate logging statements for debugging and monitoring

## Current Features
- **Multi-Provider AI**: Claude Sonnet 4 (primary), Google Gemini, Ollama (local), Hugging Face with automatic intelligent fallback
- **Intelligent Code Generation**: Complete Spring Boot applications (entities, repositories, services, controllers) with proper structure
- **Documentation-Aware**: Reads README.md, copilot-instructions.md, and package.json for project context and conventions
- **Extended Processing**: 10-minute timeout for complex AI analysis with proper timeout handling
- **Robust Error Handling**: Comprehensive fallback systems, error recovery, and user-friendly error messages
- **Workspace Management**: Automatic cleanup after issue processing with proper resource management
- **Pattern Recognition**: Follows existing project conventions and coding standards automatically
- **Webhook Security**: Proper webhook signature validation and secure event processing
- **Health Monitoring**: Built-in health check endpoints for monitoring and debugging

## Issue Processing Workflow
1. **Webhook Reception**: GitHub issue events trigger secure webhook processing with signature validation
2. **Content Analysis**: AI analyzes issue title, body, labels, and project documentation for context
3. **Repository Management**: Clone/update target repository with proper error handling
4. **Branch Creation**: Create feature branch with sanitized naming conventions
5. **AI Code Generation**: Generate complete Spring Boot components using multi-provider AI system
6. **Implementation**: Create and organize generated files following project structure
7. **Git Operations**: Commit changes, push to remote, and create detailed pull request
8. **Notification**: Comment on issue with results, error details, and cleanup status

## Supported Issue Types
- **Entity Creation**: `Add {Entity} entity` → Generates complete JPA entity with repository, service, controller
- **Feature Implementation**: `Implement {feature}` → Analyzes requirements and generates comprehensive solution
- **API Development**: `Create REST API for {resource}` → Full CRUD implementation with proper endpoints
- **Bug Fixes**: `Fix {issue}` → Analyzes problem and implements targeted solution
- **Custom Requests**: Flexible analysis of any development request with intelligent code generation

## Environment Configuration
- `GITHUB_TOKEN`: Personal access token with repo, issues, and pull_requests permissions
- `WEBHOOK_SECRET`: Webhook security secret for signature validation
- `ANTHROPIC_API_KEY`: Claude Sonnet 4 API key (primary AI provider for best results)
- `GOOGLE_API_KEY`: Optional Google Gemini API key for secondary AI provider
- `OLLAMA_URL`: Local Ollama service URL (default: http://localhost:11434)
- `OLLAMA_MODEL`: AI model name for local inference (e.g., codellama:7b, qwen2:0.5b)
- `HUGGINGFACE_API_KEY`: Optional HuggingFace API key for additional fallback
- `PORT`: Server port configuration (default: 3000)

## Error Handling and Debugging
- Comprehensive logging with structured error messages and context
- Graceful fallback to alternative AI providers when primary services fail
- Template-based code generation as final fallback when all AI services unavailable
- Detailed issue comments with error information and troubleshooting guidance
- Health check endpoints for monitoring service status and dependencies
- Timeout handling with appropriate cleanup and user notification
- Webhook signature validation errors with security logging
