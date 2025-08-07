# GitHub Agent Copilot Instructions

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# GitHub Agent Copilot Instructions

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

## Project Overview
This is a production-ready GitHub automation agent with **multi-agent orchestration** that acts as a fullstack developer. The system:
- Coordinates multiple specialized agents for comprehensive issue processing
- Uses AI-powered analysis for intelligent Spring Boot code generation
- Sends automated email notifications to teams when PRs are created
- Automatically implements complete solutions with proper error handling
- Provides robust fallback systems and performance monitoring

## Current Architecture
- **Multi-Agent Orchestration** using MultiAgentOrchestrator for coordinating specialized agents
- **Express.js server** with TypeScript for webhook handling and comprehensive API endpoints
- **Specialized Agents**: GitHubAgent (code generation), EmailNotificationAgent (notifications)
- **Multi-provider AI integration** using FreeAIService (Ollama, Hugging Face, Google Gemini)
- **Email notification system** using nodemailer with SMTP integration
- **GitHub API integration** using @octokit/rest and @octokit/webhooks
- **Git operations** using simple-git for repository management
- **Documentation-aware AI** that reads project context for better code generation

## Key Components
- `MultiAgentOrchestrator`: Coordinates all agents, manages timeouts, and handles orchestration workflow
- `GitHubAgent`: Core automation logic with AI-enhanced issue processing and PR creation
- `EmailNotificationAgent`: Professional email notifications with HTML templates and group targeting
- `FreeAIService`: Multi-provider AI service with intelligent fallback system
- `WebhookHandler`: Enhanced webhook processing with orchestration integration
- `index.ts`: Express server with health and status endpoints

## Development Guidelines
- Follow TypeScript best practices with strict type checking enabled
- Use async/await for all asynchronous operations with proper error handling
- Implement comprehensive logging for debugging and monitoring (orchestration workflow)
- Follow RESTful API conventions for endpoints
- Use environment variables for all configuration (GitHub tokens, AI API keys, email settings)
- Maintain clear separation of concerns between agents and services
- Ensure all AI operations have fallback mechanisms when services are unavailable
- Write clean, maintainable code with proper documentation
- Handle timeouts gracefully (15-minute orchestration timeout, 10-minute AI timeout)
- Follow existing project patterns and conventions
- Design agents to be independent and loosely coupled
- Implement proper error boundaries between orchestration phases

## Multi-Agent Orchestration Guidelines
- Each agent should have a single, well-defined responsibility
- Agents must handle failures gracefully without breaking the entire workflow
- Use the orchestrator for coordinating complex workflows between agents
- Implement proper timeout handling for each orchestration phase
- Provide comprehensive status monitoring and health checks
- Log orchestration workflow progress for debugging and monitoring
- Design agents to be configurable and environment-aware
- Ensure backward compatibility when adding new agents

## AI Integration Guidelines
- Always provide fallback templates when AI services are unavailable
- Use project documentation (README, copilot instructions, package.json) for context-aware generation
- Follow existing codebase patterns and naming conventions
- Generate complete, production-ready Spring Boot code
- Include proper JPA annotations, validation, and error handling
- Maintain consistency with existing project structure and packages

## Email Notification Guidelines
- Use professional HTML email templates with proper branding
- Include all relevant PR information (repository, issue, branch, files)
- Support both HTML and plain text email formats
- Implement configurable recipient groups (developers, managers, QA)
- Handle SMTP failures gracefully without blocking code generation
- Provide clear call-to-action buttons and next steps
- Log email sending status for monitoring and debugging
- Support different email providers (Gmail, Outlook, custom SMTP)

## Key Technologies
- **Runtime**: TypeScript/Node.js with Express.js
- **GitHub Integration**: @octokit/rest, @octokit/webhooks
- **Repository Operations**: simple-git
- **AI Services**: Ollama (local), Hugging Face API, Google Gemini
- **Email Services**: nodemailer with SMTP support
- **Configuration**: dotenv for environment management
- **Development**: nodemon with hot reloading

## Multi-Agent Workflow
1. **Webhook Reception**: GitHub issue events trigger the orchestrator
2. **Issue Analysis**: Orchestrator validates issue criteria and starts processing
3. **Phase 1 - Code Generation**: GitHubAgent processes issue with AI assistance
4. **Phase 2 - Email Notification**: EmailNotificationAgent sends team notifications
5. **Result Aggregation**: Orchestrator logs results and manages cleanup
6. **Status Monitoring**: Real-time status available via /status endpoint

## Multi-Agent Workflow
1. **Webhook Reception**: GitHub issue events trigger the orchestrator
2. **Issue Analysis**: Orchestrator validates issue criteria and starts processing
3. **Phase 1 - Code Generation**: GitHubAgent processes issue with AI assistance
4. **Phase 2 - Email Notification**: EmailNotificationAgent sends team notifications
5. **Result Aggregation**: Orchestrator logs results and manages cleanup
6. **Status Monitoring**: Real-time status available via /status endpoint

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
- **Multi-Agent Orchestration**: Coordinated workflow between specialized agents
- **Email Notifications**: Professional team notifications when PRs are created
- **Multi-Provider AI**: Ollama (local), Hugging Face, Google Gemini with automatic fallback
- **Intelligent Code Generation**: Complete Spring Boot applications (entities, repositories, services, controllers)
- **Documentation-Aware**: Reads README.md, copilot-instructions.md, and package.json for context
- **Extended Processing**: 15-minute orchestration timeout, 10-minute AI timeout
- **Robust Error Handling**: Comprehensive fallback systems and error recovery
- **Workspace Management**: Automatic cleanup after issue processing
- **Pattern Recognition**: Follows existing project conventions and coding standards
- **Pattern Recognition**: Follows existing project conventions and coding standards

## Issue Processing Workflow
1. **Webhook Reception**: GitHub issue events trigger the orchestrator
2. **Content Analysis**: AI analyzes title, body, labels, and project documentation
3. **Repository Management**: Clone/update target repository
4. **Branch Creation**: Create feature branch with sanitized naming
5. **AI Code Generation**: Generate complete Spring Boot components
6. **Implementation**: Create and organize generated files
7. **Git Operations**: Commit, push, and create pull request
8. **Email Notification**: Professional team notification with PR details
9. **Issue Comment**: Update issue with results and cleanup notification

## Supported Issue Types
- **Entity Creation**: `Add {Entity} entity` → Generates JPA entity with repository, service, controller
- **Feature Implementation**: `Implement {feature}` → Analyzes requirements and generates code
- **API Development**: `Create REST API for {resource}` → Full CRUD implementation
- **Bug Fixes**: `Fix {issue}` → Analyzes and implements solution

## Environment Configuration
- `GITHUB_TOKEN`: Personal access token with repo permissions
- `WEBHOOK_SECRET`: Webhook security secret
- `OLLAMA_URL`: Local Ollama service URL (http://localhost:11434)
- `OLLAMA_MODEL`: AI model name (codellama:7b, qwen2:0.5b)
- `HUGGINGFACE_API_KEY`: Optional HuggingFace API key
- `GOOGLE_API_KEY`: Optional Google Gemini API key

## Email Configuration (Optional)
- `SMTP_HOST`: SMTP server hostname (e.g., smtp.gmail.com)
- `SMTP_PORT`: SMTP server port (587 for TLS, 465 for SSL)
- `SMTP_USER`: SMTP username/email address
- `SMTP_PASS`: SMTP password or app-specific password
- `EMAIL_FROM`: From email address for notifications
- `NOTIFICATION_GROUPS`: JSON string with recipient groups:
  ```json
  {
    "developers": ["dev1@company.com", "dev2@company.com"],
    "managers": ["pm@company.com", "tech-lead@company.com"],
    "qa": ["qa1@company.com", "qa2@company.com"]
  }
  ```
