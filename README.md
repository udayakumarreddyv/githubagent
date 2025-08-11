# GitHub Agent - Enhanced Multi-Agent Fullstack Developer Bot

A GitHub automation agent that acts as a comprehensive fullstack developer with **Enhanced Multi-Agent Orchestration**, automatically listening to GitHub issues and implementing complete solutions including code generation, testing, deployment, and team notifications using **FREE AI integration**.

## 🚀 Enhanced Features

### 🎭 Multi-Agent Orchestration System
- **🎯 CodeAgent**: Specialized code generation with quality metrics and complexity analysis
- **🧪 TestAgent**: Automated JUnit test generation and execution with coverage reporting
- **🚀 DeployAgent**: AWS ECS/Fargate deployment automation with infrastructure provisioning
- **📧 EmailNotificationAgent**: Professional team notifications and reporting

### 🤖 Advanced AI Integration
- **🆓 Multiple Free AI Options**: Ollama (local), Hugging Face, Google Gemini with intelligent fallback
- **🧠 Smart Code Generation**: AI-powered Java Spring Boot entity, repository, service, and controller generation
- **📚 Documentation-Aware**: Reads project README, copilot instructions, and package.json for context
- **📋 Template Fallback**: Always functional even without AI services

### 🔄 Complete CI/CD Pipeline
- **🏗️ Code Generation**: Complete Spring Boot application structure with quality scoring
- **🧪 Automated Testing**: JUnit 5 + Mockito + JaCoCo coverage with configurable thresholds
- **🚀 AWS Deployment**: Docker containerization + CloudFormation + ECS Fargate deployment
- **📧 Team Notifications**: Multi-group email notifications with comprehensive reporting

### 🛠️ Core Automation Features
- **🪝 Webhook Integration**: Real-time GitHub webhook event processing
- **🌳 Automated Branch Creation**: Feature branches with sanitized naming
- **🔄 Pull Request Automation**: Detailed PRs with implementation summaries
- **🛡️ Robust Error Handling**: Comprehensive error handling with transparent issue comments
- **⏱️ Configurable Timeouts**: Extended processing time with orchestration monitoring

## 🏗️ Enhanced Architecture

### Multi-Agent System Overview

```mermaid
graph TB
    subgraph "GitHub"
        GH[GitHub Repository]
        WH[Webhook Events]
        ISS[Issues & Comments]
        PR[Pull Requests]
    end
    
    subgraph "GitHub Agent Server"
        subgraph "Express.js Application"
            EP["/webhook Endpoint"]
            HC["/health Endpoint"]
            ST["/status Endpoint"]
        end
        
        subgraph "Multi-Agent Orchestration"
            ORCH[MultiAgentOrchestrator]
            WHandler[WebhookHandler]
        end
        
        subgraph "Specialized Agents"
            CAGENT[🎯 CodeAgent]
            TAGENT[🧪 TestAgent]
            DAGENT[🚀 DeployAgent]
            EAGENT[📧 EmailAgent]
        end
        
        subgraph "Core Services"
            AIService[FreeAIService]
            DOCKER[Docker Engine]
            AWS[AWS CLI/SDK]
            MAIL[Nodemailer SMTP]
        end
        
        subgraph "AI Providers"
            OLL[Ollama Local AI]
            HF[Hugging Face API]
            GEM[Google Gemini API]
            TEMP[Template Fallback]
        end
        
        subgraph "AWS Infrastructure"
            ECR[ECR Repository]
            ECS[ECS Cluster]
            FARGATE[Fargate Tasks]
            CF[CloudFormation]
        end
        
        subgraph "Testing Infrastructure"
            JUNIT[JUnit 5]
            MOCKITO[Mockito]
            JACOCO[JaCoCo Coverage]
        end
    end
    
    subgraph "Generated Output"
        CODE[Spring Boot Code]
        TESTS[Comprehensive Tests]
        DEPLOY[AWS Deployment]
        NOTIF[Team Notifications]
    end
    
    %% Workflow connections
    ISS --> WH
    WH --> EP
    EP --> WHandler
    WHandler --> ORCH
    
    %% Orchestration flow
    ORCH --> CAGENT
    ORCH --> TAGENT
    ORCH --> DAGENT
    ORCH --> EAGENT
    
    %% Agent connections
    CAGENT --> AIService
    TAGENT --> JUNIT
    TAGENT --> MOCKITO
    TAGENT --> JACOCO
    DAGENT --> DOCKER
    DAGENT --> AWS
    DAGENT --> ECR
    DAGENT --> ECS
    DAGENT --> CF
    EAGENT --> MAIL
    
    %% AI Service connections
    AIService --> OLL
    AIService --> HF
    AIService --> GEM
    AIService --> TEMP
    
    %% Output generation
    CAGENT --> CODE
    TAGENT --> TESTS
    DAGENT --> DEPLOY
    EAGENT --> NOTIF
```

### Orchestration Pipeline

The Multi-Agent Orchestrator coordinates a sophisticated 4-phase pipeline:

1. **🎯 Code Generation Phase**
   - AI-powered Spring Boot component generation
   - Code quality analysis and scoring
   - Git branch creation and file organization

2. **🧪 Testing Phase** (Optional)
   - Automated JUnit test generation
   - Test execution with coverage reporting
   - Quality gate enforcement

3. **🚀 Deployment Phase** (Optional)
   - Docker containerization
   - AWS infrastructure provisioning
   - ECS Fargate deployment with health checks

4. **📧 Notification Phase**
   - Professional team notifications
   - Comprehensive reporting with metrics
   - Multi-group email distribution

## 🔧 Configuration

### Basic Multi-Agent Configuration

```typescript
const config: Partial<AgentConfig> = {
  enableEmailNotifications: true,
  enableTesting: true,          // Enable JUnit testing
  enableDeployment: false,      // Enable for AWS deployment
  emailGroups: ['developers', 'qa-team'],
  timeout: 20 * 60 * 1000      // 20 minutes
};
```

### AWS Deployment Configuration

```typescript
const deploymentConfig = {
  awsRegion: 'us-east-1',
  serviceName: 'my-app',
  environment: 'dev',           // dev, staging, prod
  containerPort: 8080,
  healthCheckPath: '/actuator/health',
  cpu: '256',                   // CPU units
  memory: '512',                // Memory in MB
  desiredCount: 1               // Number of tasks
};
```

## 📋 Configuration Examples

### 1. 🏃‍♂️ Development Mode (Code + Tests)
```typescript
const devConfig: Partial<AgentConfig> = {
  enableTesting: true,
  enableDeployment: false,
  enableEmailNotifications: true
};
```

### 2. 🚀 Full CI/CD Pipeline
```typescript
const productionConfig: Partial<AgentConfig> = {
  enableTesting: true,
  enableDeployment: true,
  enableEmailNotifications: true,
  deploymentConfig: {
    awsRegion: 'us-west-2',
    serviceName: 'production-app',
    environment: 'prod',
    cpu: '1024',
    memory: '2048',
    desiredCount: 3
  }
};
```

### 3. ⚡ Quick Prototyping
```typescript
const quickConfig: Partial<AgentConfig> = {
  enableTesting: false,
  enableDeployment: false,
  enableEmailNotifications: false
};
```

## 🛠️ Prerequisites

### Core Requirements
- Node.js 18+
- TypeScript
- Git
- GitHub Personal Access Token

### For Testing (TestAgent)
- Java 17+
- Maven or Gradle
- JUnit 5 dependencies
- Spring Boot Test dependencies

### For Deployment (DeployAgent)
- AWS CLI configured with appropriate permissions
- Docker installed and running
- AWS account with ECS, ECR, and CloudFormation permissions

### Required AWS Permissions
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecs:*", "ecr:*", "cloudformation:*",
        "iam:CreateRole", "iam:AttachRolePolicy", "iam:PassRole",
        "logs:*", "ec2:*"
      ],
      "Resource": "*"
    }
  ]
}
```

## ⚙️ Environment Configuration

Create a `.env` file in the root directory:

```bash
# Required - GitHub Configuration
GITHUB_TOKEN=your_github_personal_access_token
WEBHOOK_SECRET=your_webhook_secret_string

# Optional - AI Service Configuration
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=codellama:7b
HUGGINGFACE_API_KEY=your_huggingface_api_key
GOOGLE_API_KEY=your_google_gemini_api_key

# Optional - Email Notification Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_specific_password
EMAIL_FROM=GitHub Agent <noreply@yourcompany.com>

# Email Groups Configuration (JSON string)
NOTIFICATION_GROUPS={"developers":["dev1@company.com"],"managers":["pm@company.com"],"qa":["qa@company.com"]}

# Optional - AWS Configuration (for deployment)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
```

## 🚀 Quick Start

### 1. Installation
```bash
git clone <repository-url>
cd githubagent
npm install
```

### 2. Configuration
```bash
# Copy and configure environment variables
cp .env.example .env
# Edit .env with your configuration
```

### 3. Local AI Setup (Optional)
```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Download a code generation model
ollama pull codellama:7b
# Or use a smaller, faster model
ollama pull qwen2:0.5b

# Start Ollama service
ollama serve
```

### 4. Build and Run
```bash
# Build the application
npm run build

# Start the server
npm start

# Or run in development mode with hot reload
npm run dev
```

### 5. GitHub Webhook Setup
1. Go to your repository settings → Webhooks
2. Add webhook URL: `https://your-domain.com/webhook`
3. Set content type: `application/json`
4. Add webhook secret (same as in your `.env`)
5. Select events: Issues, Issue comments, Pull requests

## 📊 Usage Examples

### Demo Script
```bash
# Run the comprehensive demo
node demo-multi-agent.js
```

### Manual Orchestration
```typescript
import { MultiAgentOrchestrator } from './src/agent/MultiAgentOrchestrator';
import { GitHubAgent } from './src/agent/GitHubAgent';

const githubAgent = new GitHubAgent(octokit);
const orchestrator = new MultiAgentOrchestrator(githubAgent, {
  enableTesting: true,
  enableDeployment: false,
  enableEmailNotifications: true
});

const result = await orchestrator.orchestrateIssueProcessing(issueData);
```

## 📈 Results and Metrics

The orchestration system provides comprehensive results:

```typescript
interface OrchestrationResult {
  success: boolean;
  agentResults: {
    codeGeneration: boolean;    // Code generation status
    testing: boolean;           // Test generation and execution
    deployment: boolean;        // AWS deployment status
    emailNotification: boolean; // Team notification status
  };
  prUrl?: string;              // Generated pull request URL
  serviceUrl?: string;         // Deployed service URL
  testResults?: TestResult;    // Detailed test metrics
  deploymentResults?: DeploymentResult; // Deployment details
  errors: string[];            // Any errors encountered
  timing: {                    // Performance metrics
    codeGeneration: number;
    testing: number;
    deployment: number;
    emailNotification: number;
    total: number;
  };
}
```

## 🎯 Supported Issue Types

### Code Generation
- **Entity Creation**: `Add {Entity} entity` → Complete JPA entity with relationships
- **API Development**: `Create REST API for {resource}` → Full CRUD implementation
- **Feature Implementation**: `Implement {feature}` → Analyzes requirements and generates code
- **Bug Fixes**: `Fix {issue}` → Analyzes and implements solution

### Testing
- **Unit Tests**: Individual component testing with mocking
- **Integration Tests**: End-to-end API testing
- **Coverage Reports**: JaCoCo integration with configurable thresholds

### Deployment
- **Development**: Single-instance deployment for testing
- **Staging**: Multi-instance deployment with load balancing
- **Production**: High-availability deployment with auto-scaling

## 🔍 Monitoring and Observability

### Health Checks
- **Application Health**: `GET /health`
- **Agent Status**: `GET /status`
- **Webhook Status**: Real-time webhook event logs

### Metrics and Logging
- Detailed execution timing for each phase
- Code quality scores and complexity analysis
- Test coverage metrics and pass/fail rates
- Deployment success rates and rollback triggers
- Email delivery status and recipient analytics

## 🆘 Troubleshooting

### Common Issues

1. **AI Service Not Available**
   - **Ollama**: Check if service is running (`ollama serve`)
   - **Models**: Verify model is installed (`ollama list`)
   - **Fallback**: Agent uses templates when AI is unavailable

2. **Testing Issues**
   - **Java/Maven**: Ensure Java 17+ and Maven are properly installed
   - **Dependencies**: Check if Spring Boot Test dependencies are configured
   - **Test Execution**: Verify test directory structure and naming conventions

3. **Deployment Issues**
   - **AWS CLI**: Ensure AWS CLI is configured (`aws configure`)
   - **Docker**: Verify Docker is running and accessible
   - **Permissions**: Check AWS IAM permissions for ECS, ECR, CloudFormation

4. **Webhook Issues**
   - Verify webhook URL is accessible (use ngrok for local testing)
   - Check webhook secret matches your `.env` configuration
   - Ensure webhook events include "Issues" and "Issue comments"

5. **GitHub API Issues**
   - Verify token has correct permissions (repo, issues, pull_requests)
   - Check rate limits in GitHub API responses
   - Ensure bot has access to target repositories

### Debug Mode

For verbose logging, run in development mode:
```bash
npm run dev
```

Monitor logs for:
- Multi-agent orchestration workflow
- Individual agent execution status
- AI service initialization and fallback
- Test execution results and coverage
- Deployment progress and health checks
- Email notification delivery status

### Performance Optimization

- **Faster AI**: Use `qwen2:0.5b` model for quicker responses
- **Parallel Testing**: Configure parallel test execution
- **AWS Regions**: Choose region closest to your location
- **Resource Allocation**: Adjust CPU/memory based on workload

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes with tests
4. Update documentation
5. Submit a pull request

## 📄 License

ISC License - see LICENSE file for details.

## 🌟 Features Roadmap

- **🔒 Security Scanning**: Automated vulnerability analysis
- **⚡ Performance Testing**: Load testing integration
- **☁️ Multi-Cloud Support**: Azure and GCP deployment options
- **📊 Advanced Monitoring**: Prometheus/Grafana integration
- **🔄 GitOps Integration**: ArgoCD/Flux support
- **🤖 Advanced AI**: Model fine-tuning and custom training
