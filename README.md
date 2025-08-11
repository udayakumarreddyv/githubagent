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

## 🔄 Detailed Workflow Diagrams

### Multi-Agent Orchestration Flow

```mermaid
flowchart TD
    A[GitHub Issue Created] --> B{Issue Analysis}
    B -->|Valid Request| C[Start Multi-Agent Orchestration]
    B -->|Invalid| Z[Skip Processing]
    
    C --> D[Phase 1: CodeAgent]
    D --> E{Code Generation Success?}
    E -->|Yes| F{Testing Enabled?}
    E -->|No| X[Report Failure & Exit]
    
    F -->|Yes| G[Phase 2: TestAgent]
    F -->|No| M{Deployment Enabled?}
    
    G --> H{Tests Pass?}
    H -->|Yes| I{Deployment Enabled?}
    H -->|No| J[Report Test Failures]
    
    I -->|Yes| K[Phase 3: DeployAgent]
    I -->|No| O[Phase 4: EmailAgent]
    
    K --> L{Deployment Success?}
    L -->|Yes| O
    L -->|No| N[Rollback & Report]
    
    M -->|Yes| K
    M -->|No| O
    
    O --> P[Send Notifications]
    P --> Q[Update Issue with Results]
    Q --> R[Cleanup Workspace]
    
    J --> O
    N --> O
    X --> Q
    Z --> END[End]
    R --> END
    
    style C fill:#e1f5fe
    style D fill:#f3e5f5
    style G fill:#e8f5e8
    style K fill:#fff3e0
    style O fill:#fce4ec
```

### CodeAgent Detailed Workflow

```mermaid
flowchart TD
    A[Receive Issue Data] --> B[Analyze Requirements]
    B --> C[Extract Entity Information]
    C --> D[Calculate Complexity Score]
    D --> E{AI Service Available?}
    
    E -->|Yes| F[Generate with AI]
    E -->|No| G[Use Template Fallback]
    
    F --> H[AI Component Generation]
    H --> I[Entity Creation]
    I --> J[Repository Generation]
    J --> K[Service Layer Creation]
    K --> L[Controller Implementation]
    
    G --> I
    
    L --> M[Calculate Code Quality Score]
    M --> N[Create Feature Branch]
    N --> O[Organize File Structure]
    O --> P[Commit Changes]
    P --> Q[Create Pull Request]
    Q --> R[Return Results with Metrics]
    
    style F fill:#c8e6c9
    style G fill:#ffecb3
    style M fill:#e1bee7
```

### TestAgent Workflow

```mermaid
flowchart TD
    A[Receive Generated Code Files] --> B[Analyze Test Requirements]
    B --> C[Determine Test Types Needed]
    C --> D{Mocking Required?}
    
    D -->|Yes| E[Setup Mockito Configuration]
    D -->|No| F[Setup Basic Test Structure]
    
    E --> G[Generate Unit Tests]
    F --> G
    
    G --> H[Generate Integration Tests]
    H --> I[Configure JaCoCo Coverage]
    I --> J[Update Maven Dependencies]
    J --> K[Execute Test Suite]
    
    K --> L{Tests Pass?}
    L -->|Yes| M[Generate Coverage Report]
    L -->|No| N[Collect Failure Details]
    
    M --> O[Calculate Coverage Metrics]
    O --> P[Return Success Results]
    
    N --> Q[Return Failure Results]
    
    style K fill:#ffcdd2
    style M fill:#c8e6c9
    style O fill:#e1bee7
```

### DeployAgent AWS Workflow

```mermaid
flowchart TD
    A[Receive Test Results] --> B{Tests Passed?}
    B -->|No| Z[Skip Deployment]
    B -->|Yes| C[Validate AWS Prerequisites]
    
    C --> D[Create Dockerfile]
    D --> E[Build Docker Image]
    E --> F[Setup CloudFormation Template]
    F --> G[Deploy Infrastructure Stack]
    
    G --> H{Stack Deployment Success?}
    H -->|No| Y[Report Infrastructure Failure]
    H -->|Yes| I[Push Image to ECR]
    
    I --> J[Update ECS Service]
    J --> K[Wait for Deployment Stabilization]
    K --> L[Perform Health Checks]
    
    L --> M{Health Check Pass?}
    M -->|Yes| N[Return Success with Service URL]
    M -->|No| O[Initiate Rollback]
    
    O --> P[Restore Previous Task Definition]
    P --> Q[Return Failure with Rollback Status]
    
    Z --> END[End]
    Y --> END
    N --> END
    Q --> END
    
    style G fill:#fff3e0
    style L fill:#e8f5e8
    style O fill:#ffcdd2
```

### AWS Infrastructure Provisioning

```mermaid
graph TB
    subgraph "CloudFormation Stack"
        CF[CloudFormation Template]
        
        subgraph "Networking"
            VPC[VPC 10.0.0.0/16]
            IGW[Internet Gateway]
            PUB1[Public Subnet 1]
            PUB2[Public Subnet 2]
            RT[Route Table]
            SG[Security Group]
        end
        
        subgraph "Container Infrastructure"
            ECR[ECR Repository]
            ECS[ECS Cluster]
            TD[Task Definition]
            SVC[ECS Service]
            FARGATE[Fargate Tasks]
        end
        
        subgraph "Monitoring"
            CW[CloudWatch Logs]
            HC[Health Checks]
        end
        
        subgraph "IAM"
            EXEC[Task Execution Role]
            TASK[Task Role]
        end
    end
    
    CF --> VPC
    VPC --> IGW
    VPC --> PUB1
    VPC --> PUB2
    VPC --> SG
    IGW --> RT
    RT --> PUB1
    RT --> PUB2
    
    CF --> ECR
    CF --> ECS
    ECS --> TD
    TD --> SVC
    SVC --> FARGATE
    
    CF --> CW
    CF --> EXEC
    CF --> TASK
    
    FARGATE --> HC
    
    style VPC fill:#e3f2fd
    style ECS fill:#f3e5f5
    style ECR fill:#e8f5e8
    style FARGATE fill:#fff3e0
```

### End-to-End Multi-Agent Sequence Diagram

```mermaid
sequenceDiagram
    participant GitHub as GitHub Repository
    participant WH as Webhook Handler
    participant ORCH as Multi-Agent Orchestrator
    participant CODE as CodeAgent
    participant AI as AI Service (Ollama/HF/Gemini)
    participant TEST as TestAgent
    participant DEPLOY as DeployAgent
    participant AWS as AWS Infrastructure
    participant EMAIL as EmailAgent
    participant SMTP as Email Service
    participant TEAM as Team Members

    Note over GitHub,TEAM: GitHub Issue Creation & Multi-Agent Processing

    GitHub->>WH: Issue Created Event
    WH->>WH: Validate Webhook Signature
    WH->>WH: Parse Issue Data
    WH->>ORCH: Trigger Multi-Agent Processing
    
    Note over ORCH: Orchestration Initialization
    ORCH->>ORCH: Initialize Agent Configuration
    ORCH->>ORCH: Validate Processing Criteria
    ORCH->>ORCH: Start 15-minute Timeout Timer
    
    rect rgb(240, 248, 255)
        Note over ORCH,AI: Phase 1: Code Generation (CodeAgent)
        ORCH->>CODE: Execute Code Generation Phase
        CODE->>CODE: Analyze Issue Requirements
        CODE->>CODE: Extract Entity Information
        CODE->>CODE: Calculate Complexity Score
        
        alt AI Service Available
            CODE->>AI: Request Code Generation
            AI->>AI: Generate Entity Components
            AI->>CODE: Return Generated Code
        else AI Service Unavailable
            CODE->>CODE: Use Template Fallback
        end
        
        CODE->>CODE: Create Feature Branch
        CODE->>CODE: Generate Entity, Repository, Service, Controller
        CODE->>CODE: Organize File Structure
        CODE->>GitHub: Commit Changes
        CODE->>GitHub: Create Pull Request
        CODE->>ORCH: Return Success with PR URL
    end
    
    alt Testing Enabled
        rect rgb(248, 255, 248)
            Note over ORCH,TEST: Phase 2: Testing (TestAgent)
            ORCH->>TEST: Execute Testing Phase
            TEST->>TEST: Analyze Generated Code
            TEST->>TEST: Generate JUnit Test Classes
            TEST->>TEST: Setup Mockito Configuration
            TEST->>TEST: Configure JaCoCo Coverage
            TEST->>TEST: Execute Test Suite
            
            alt Tests Pass
                TEST->>TEST: Generate Coverage Report
                TEST->>TEST: Validate Coverage Threshold
                TEST->>ORCH: Return Success with Metrics
            else Tests Fail
                TEST->>TEST: Collect Failure Details
                TEST->>ORCH: Return Failure with Details
                ORCH->>GitHub: Comment Test Failures
            end
        end
    end
    
    alt Deployment Enabled & Tests Passed
        rect rgb(255, 248, 240)
            Note over ORCH,AWS: Phase 3: Deployment (DeployAgent)
            ORCH->>DEPLOY: Execute Deployment Phase
            DEPLOY->>DEPLOY: Validate AWS Prerequisites
            DEPLOY->>DEPLOY: Create Dockerfile
            DEPLOY->>DEPLOY: Build Docker Image
            DEPLOY->>AWS: Create CloudFormation Stack
            AWS->>AWS: Provision VPC, Subnets, Security Groups
            AWS->>AWS: Create ECS Cluster & ECR Repository
            AWS->>DEPLOY: Infrastructure Ready
            
            DEPLOY->>AWS: Push Image to ECR
            DEPLOY->>AWS: Deploy ECS Service
            AWS->>AWS: Start Fargate Tasks
            AWS->>AWS: Perform Health Checks
            
            alt Deployment Success
                AWS->>DEPLOY: Service Running & Healthy
                DEPLOY->>ORCH: Return Success with Service URL
            else Deployment Failure
                AWS->>DEPLOY: Health Check Failed
                DEPLOY->>AWS: Initiate Rollback
                AWS->>AWS: Restore Previous Task Definition
                DEPLOY->>ORCH: Return Failure with Rollback Status
            end
        end
    end
    
    rect rgb(255, 240, 245)
        Note over ORCH,TEAM: Phase 4: Email Notification (EmailAgent)
        ORCH->>EMAIL: Execute Notification Phase
        EMAIL->>EMAIL: Prepare Notification Data
        EMAIL->>EMAIL: Generate HTML Email Template
        EMAIL->>EMAIL: Include PR Details & Results
        EMAIL->>EMAIL: Add Service URLs & Metrics
        
        loop For Each Recipient Group
            EMAIL->>SMTP: Send Professional Notification
            SMTP->>TEAM: Deliver Email to Team Members
        end
        
        EMAIL->>ORCH: Return Notification Status
    end
    
    Note over ORCH: Orchestration Finalization
    ORCH->>ORCH: Aggregate All Results
    ORCH->>ORCH: Calculate Total Execution Time
    ORCH->>GitHub: Update Issue with Final Results
    ORCH->>ORCH: Log Orchestration Metrics
    ORCH->>ORCH: Cleanup Workspace
    
    Note over GitHub,TEAM: Process Complete - Team Notified
    
    rect rgb(255, 245, 245)
        Note over ORCH: Error Handling & Fallbacks
        alt Any Phase Fails
            ORCH->>ORCH: Log Error Details
            ORCH->>GitHub: Comment Error Information
            ORCH->>EMAIL: Send Failure Notification
            EMAIL->>SMTP: Alert Team of Failure
            SMTP->>TEAM: Deliver Failure Alert
        end
        
        alt Timeout Exceeded (15 minutes)
            ORCH->>ORCH: Force Cleanup
            ORCH->>GitHub: Comment Timeout Information
            ORCH->>EMAIL: Send Timeout Notification
        end
    end
```

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

### AWS Account Setup

#### Required AWS Services
- **Amazon ECS** (Elastic Container Service)
- **Amazon ECR** (Elastic Container Registry)
- **AWS CloudFormation** (Infrastructure as Code)
- **Amazon VPC** (Virtual Private Cloud)
- **AWS IAM** (Identity and Access Management)
- **Amazon CloudWatch** (Logging and Monitoring)

#### AWS Account Configuration Steps

1. **Create AWS Account**
   ```bash
   # Sign up at: https://aws.amazon.com/
   # Choose appropriate billing plan
   ```

2. **Configure AWS CLI**
   ```bash
   # Install AWS CLI
   curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
   unzip awscliv2.zip
   sudo ./aws/install
   
   # Configure credentials
   aws configure
   # AWS Access Key ID: [Your Access Key]
   # AWS Secret Access Key: [Your Secret Key]  
   # Default region: us-east-1
   # Default output format: json
   ```

3. **Create IAM User for GitHub Agent**
   ```bash
   # Create user with programmatic access
   aws iam create-user --user-name github-agent-deployment
   
   # Attach required policies
   aws iam attach-user-policy --user-name github-agent-deployment \
     --policy-arn arn:aws:iam::aws:policy/AmazonECS_FullAccess
   
   aws iam attach-user-policy --user-name github-agent-deployment \
     --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryFullAccess
   
   aws iam attach-user-policy --user-name github-agent-deployment \
     --policy-arn arn:aws:iam::aws:policy/CloudFormationFullAccess
   
   aws iam attach-user-policy --user-name github-agent-deployment \
     --policy-arn arn:aws:iam::aws:policy/IAMFullAccess
   
   # Create access keys
   aws iam create-access-key --user-name github-agent-deployment
   ```

#### AWS Cost Estimation

| Service | Usage | Monthly Cost (USD) |
|---------|-------|-------------------|
| ECS Fargate | 1 task, 0.25 vCPU, 0.5GB | ~$10-15 |
| ECR Storage | 1-5 Docker images | ~$1-3 |
| CloudWatch Logs | Standard logging | ~$1-2 |
| Data Transfer | Minimal | ~$1 |
| **Total Estimated** | | **~$13-21/month** |

#### Environment-Specific Configurations

```typescript
// Development Environment
const devConfig = {
  awsRegion: 'us-east-1',
  serviceName: 'myapp-dev',
  environment: 'dev',
  cpu: '256',           // 0.25 vCPU
  memory: '512',        // 0.5 GB
  desiredCount: 1
};

// Staging Environment  
const stagingConfig = {
  awsRegion: 'us-east-1',
  serviceName: 'myapp-staging',
  environment: 'staging',
  cpu: '512',           // 0.5 vCPU
  memory: '1024',       // 1 GB
  desiredCount: 2
};

// Production Environment
const prodConfig = {
  awsRegion: 'us-west-2',
  serviceName: 'myapp-prod',
  environment: 'prod',
  cpu: '1024',          // 1 vCPU
  memory: '2048',       // 2 GB
  desiredCount: 3
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

# AWS Configuration (Required for DeployAgent)
AWS_ACCOUNT_ID=123456789012
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_REGION=us-east-1

# AWS Deployment Settings
AWS_ECR_REGISTRY=123456789012.dkr.ecr.us-east-1.amazonaws.com
AWS_ECS_CLUSTER_PREFIX=github-agent
DEPLOYMENT_SERVICE_NAME=github-agent-app
DEPLOYMENT_ENVIRONMENT=dev
DEPLOYMENT_CONTAINER_PORT=8080
DEPLOYMENT_HEALTH_CHECK_PATH=/actuator/health

# Resource Allocation
DEPLOYMENT_CPU=256
DEPLOYMENT_MEMORY=512
DEPLOYMENT_DESIRED_COUNT=1

# Testing Configuration
TEST_COVERAGE_THRESHOLD=80
JUNIT_VERSION=5.9.2
MOCKITO_VERSION=5.1.1
JACOCO_VERSION=0.8.8
```

### AWS Environment Variables Explained

| Variable | Description | Example |
|----------|-------------|---------|
| `AWS_ACCOUNT_ID` | Your 12-digit AWS account ID | `123456789012` |
| `AWS_ACCESS_KEY_ID` | IAM user access key for deployment | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret key | `wJalrXUtnFEMI/K7MDENG/...` |
| `AWS_REGION` | AWS region for deployment | `us-east-1`, `us-west-2` |
| `AWS_ECR_REGISTRY` | ECR registry URL | `{account}.dkr.ecr.{region}.amazonaws.com` |
| `DEPLOYMENT_CPU` | ECS task CPU units | `256` (0.25 vCPU), `1024` (1 vCPU) |
| `DEPLOYMENT_MEMORY` | ECS task memory in MB | `512`, `1024`, `2048` |
| `DEPLOYMENT_DESIRED_COUNT` | Number of running tasks | `1` (dev), `3` (prod) |

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

### 6. AWS Setup (Optional - for DeployAgent)

#### Step 1: Create AWS Account & IAM User
```bash
# 1. Create AWS account at https://aws.amazon.com/
# 2. Create IAM user for GitHub Agent deployment

# Install AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Configure AWS CLI
aws configure
# AWS Access Key ID: [Your Key]
# AWS Secret Access Key: [Your Secret]
# Default region: us-east-1
# Default output format: json
```

#### Step 2: Setup IAM Permissions
Create an IAM policy for GitHub Agent deployment:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecs:*",
        "ecr:*",
        "cloudformation:*",
        "iam:CreateRole",
        "iam:AttachRolePolicy",
        "iam:PassRole",
        "iam:GetRole",
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "ec2:CreateVpc",
        "ec2:CreateSubnet",
        "ec2:CreateSecurityGroup",
        "ec2:CreateInternetGateway",
        "ec2:AttachInternetGateway",
        "ec2:CreateRouteTable",
        "ec2:CreateRoute",
        "ec2:AssociateRouteTable",
        "ec2:DescribeVpcs",
        "ec2:DescribeSubnets",
        "ec2:DescribeSecurityGroups",
        "ec2:DescribeAvailabilityZones"
      ],
      "Resource": "*"
    }
  ]
}
```

#### Step 3: Test AWS Connection
```bash
# Verify AWS CLI setup
aws sts get-caller-identity

# Check ECR access
aws ecr describe-repositories --region us-east-1

# Test ECS access
aws ecs list-clusters --region us-east-1
```

#### Step 4: Docker Setup
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Start Docker service
sudo systemctl start docker
sudo systemctl enable docker

# Verify Docker installation
docker --version
docker run hello-world
```

#### Step 5: Test Deployment (Optional)
```bash
# Run deployment test with demo configuration
npm run build
node -e "
const { DeployAgent } = require('./dist/agent/DeployAgent.js');
const agent = new DeployAgent();
console.log('DeployAgent initialized successfully for AWS deployment');
"
```

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
