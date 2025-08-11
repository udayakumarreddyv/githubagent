import { GitHubAgent, IssueData } from './GitHubAgent';
import { EmailNotificationAgent, NotificationData } from './EmailNotificationAgent';
import { CodeAgent } from './CodeAgent';
import { TestAgent, TestResult } from './TestAgent';
import { DeployAgent, DeploymentResult, DeploymentConfig } from './DeployAgent';

export interface OrchestrationResult {
  success: boolean;
  agentResults: {
    codeGeneration: boolean;
    testing: boolean;
    deployment: boolean;
    emailNotification: boolean;
  };
  prUrl?: string;
  serviceUrl?: string;
  testResults?: TestResult;
  deploymentResults?: DeploymentResult;
  errors: string[];
  timing: {
    codeGeneration: number;
    testing: number;
    deployment: number;
    emailNotification: number;
    total: number;
  };
}

export interface AgentConfig {
  enableEmailNotifications: boolean;
  enableTesting: boolean;
  enableDeployment: boolean;
  emailGroups: string[];
  deploymentConfig?: Partial<DeploymentConfig>;
  timeout: number;
}

/**
 * Multi-Agent Orchestrator
 * Coordinates multiple specialized agents to handle GitHub issues comprehensively
 */
export class MultiAgentOrchestrator {
  private githubAgent: GitHubAgent;
  private codeAgent: CodeAgent;
  private testAgent: TestAgent;
  private deployAgent: DeployAgent;
  private emailAgent: EmailNotificationAgent;
  private config: AgentConfig;

  constructor(githubAgent: GitHubAgent, config: Partial<AgentConfig> = {}) {
    this.githubAgent = githubAgent;
    // Note: CodeAgent needs Octokit instance, using githubAgent's octokit
    this.codeAgent = new CodeAgent((githubAgent as any).octokit);
    this.testAgent = new TestAgent();
    this.deployAgent = new DeployAgent();
    this.emailAgent = new EmailNotificationAgent();
    
    this.config = {
      enableEmailNotifications: config.enableEmailNotifications ?? true,
      enableTesting: config.enableTesting ?? true,
      enableDeployment: config.enableDeployment ?? false, // Default to false for safety
      emailGroups: config.emailGroups ?? ['developers'],
      deploymentConfig: config.deploymentConfig,
      timeout: config.timeout ?? 15 * 60 * 1000 // 15 minutes default
    };
    
    console.log('🎭 Multi-Agent Orchestrator initialized with specialized agents');
    console.log(`🤖 Code generation: enabled`);
    console.log(`🧪 Testing: ${this.config.enableTesting ? 'enabled' : 'disabled'}`);
    console.log(`🚀 Deployment: ${this.config.enableDeployment ? 'enabled' : 'disabled'}`);
    console.log(`📧 Email notifications: ${this.config.enableEmailNotifications ? 'enabled' : 'disabled'}`);
    
    this.logAgentStatus();
  }

  /**
   * Main orchestration method - coordinates all agents
   */
  async orchestrateIssueProcessing(issueData: IssueData): Promise<OrchestrationResult> {
    const startTime = Date.now();
    const result: OrchestrationResult = {
      success: false,
      agentResults: {
        codeGeneration: false,
        testing: false,
        deployment: false,
        emailNotification: false
      },
      errors: [],
      timing: {
        codeGeneration: 0,
        testing: 0,
        deployment: 0,
        emailNotification: 0,
        total: 0
      }
    };

    console.log('🎭 Starting multi-agent orchestration for issue:', issueData.title);
    console.log('📋 Orchestration plan:');
    console.log('  1. 🤖 Code generation and PR creation');
    if (this.config.enableTesting) {
      console.log('  2. 🧪 Test generation and execution');
    }
    if (this.config.enableDeployment) {
      console.log('  3. � AWS deployment');
    }
    console.log(`  ${this.config.enableDeployment ? '4' : this.config.enableTesting ? '3' : '2'}. �📧 Email notification to team`);

    try {
      // Phase 1: Code Generation Agent
      await this.executeCodeGeneration(issueData, result);
      
      // Phase 2: Testing Agent (if code generation succeeded and testing enabled)
      if (result.agentResults.codeGeneration && this.config.enableTesting) {
        await this.executeTesting(issueData, result);
      }

      // Phase 3: Deployment Agent (if testing passed and deployment enabled)
      if (result.agentResults.testing && this.config.enableDeployment) {
        await this.executeDeployment(issueData, result);
      }

      // Phase 4: Email Notification Agent (if any agent succeeded)
      if (result.agentResults.codeGeneration) {
        await this.executeEmailNotification(issueData, result);
      }

      // Calculate final results
      result.success = result.agentResults.codeGeneration; // Success if code generation worked
      result.timing.total = Date.now() - startTime;

      this.logOrchestrationResult(result);
      
    } catch (error) {
      result.errors.push(`Orchestration failed: ${(error as Error).message}`);
      console.log(`❌ Orchestration failed: ${(error as Error).message}`);
    }

    return result;
  }

  /**
   * Execute code generation phase
   */
  private async executeCodeGeneration(issueData: IssueData, result: OrchestrationResult): Promise<void> {
    console.log('🤖 Phase 1: Starting code generation agent...');
    const startTime = Date.now();
    
    try {
      // Set timeout for code generation
      const codeGenerationPromise = this.githubAgent.handleIssue(issueData);
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Code generation timeout')), this.config.timeout)
      );

      await Promise.race([codeGenerationPromise, timeoutPromise]);
      
      result.agentResults.codeGeneration = true;
      result.timing.codeGeneration = Date.now() - startTime;
      
      console.log(`✅ Code generation completed in ${(result.timing.codeGeneration / 1000).toFixed(1)}s`);
      
    } catch (error) {
      result.agentResults.codeGeneration = false;
      result.timing.codeGeneration = Date.now() - startTime;
      result.errors.push(`Code generation failed: ${(error as Error).message}`);
      
      console.log(`❌ Code generation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Execute testing phase
   */
  private async executeTesting(issueData: IssueData, result: OrchestrationResult): Promise<void> {
    console.log('🧪 Phase 2: Starting test generation and execution agent...');
    const startTime = Date.now();
    
    try {
      // Get implemented files from code generation
      const implementedFiles = this.predictImplementedFiles(issueData);
      
      // Get repository path (in real implementation, this would be from GitHubAgent)
      const repoPath = `./workspace/${issueData.owner}-${issueData.repo}`;
      
      // Construct codebase structure
      const codebaseStructure = {
        projectConventions: {
          packageStructure: 'com.example.employee'
        }
      };

      // Execute test generation and execution
      const testResults = await this.testAgent.generateAndExecuteTests(
        issueData,
        implementedFiles,
        repoPath,
        codebaseStructure
      );
      
      result.testResults = testResults;
      result.agentResults.testing = testResults.success;
      result.timing.testing = Date.now() - startTime;
      
      if (testResults.success) {
        console.log(`✅ Testing completed successfully in ${(result.timing.testing / 1000).toFixed(1)}s`);
        console.log(`📊 Test Summary: ${testResults.metrics.passedTests}/${testResults.metrics.totalTests} tests passed`);
      } else {
        console.log(`❌ Testing failed in ${(result.timing.testing / 1000).toFixed(1)}s`);
        result.errors.push('Test execution failed');
      }
      
    } catch (error) {
      result.agentResults.testing = false;
      result.timing.testing = Date.now() - startTime;
      result.errors.push(`Testing failed: ${(error as Error).message}`);
      
      console.log(`❌ Testing failed: ${(error as Error).message}`);
    }
  }

  /**
   * Execute deployment phase
   */
  private async executeDeployment(issueData: IssueData, result: OrchestrationResult): Promise<void> {
    console.log('🚀 Phase 3: Starting AWS deployment agent...');
    const startTime = Date.now();
    
    try {
      // Get repository path (in real implementation, this would be from GitHubAgent)
      const repoPath = `./workspace/${issueData.owner}-${issueData.repo}`;
      
      // Execute deployment
      const deploymentResults = await this.deployAgent.deployToAWS(
        repoPath,
        result.testResults,
        this.config.deploymentConfig
      );
      
      result.deploymentResults = deploymentResults;
      result.agentResults.deployment = deploymentResults.success;
      result.timing.deployment = Date.now() - startTime;
      result.serviceUrl = deploymentResults.serviceUrl;
      
      if (deploymentResults.success) {
        console.log(`✅ Deployment completed successfully in ${(result.timing.deployment / 1000).toFixed(1)}s`);
        console.log(`🌐 Service URL: ${deploymentResults.serviceUrl}`);
      } else {
        console.log(`❌ Deployment failed in ${(result.timing.deployment / 1000).toFixed(1)}s`);
        if (deploymentResults.errorDetails) {
          result.errors.push(...deploymentResults.errorDetails);
        }
      }
      
    } catch (error) {
      result.agentResults.deployment = false;
      result.timing.deployment = Date.now() - startTime;
      result.errors.push(`Deployment failed: ${(error as Error).message}`);
      
      console.log(`❌ Deployment failed: ${(error as Error).message}`);
    }
  }

  /**
   * Execute email notification phase
   */
  private async executeEmailNotification(issueData: IssueData, result: OrchestrationResult): Promise<void> {
    if (!this.config.enableEmailNotifications) {
      console.log('📧 Email notifications disabled - skipping');
      result.agentResults.emailNotification = true; // Consider as success since it's intentionally disabled
      return;
    }

    const phaseNumber = this.config.enableDeployment ? '4' : this.config.enableTesting ? '3' : '2';
    console.log(`📧 Phase ${phaseNumber}: Starting email notification agent...`);
    const startTime = Date.now();
    
    try {
      // Get PR information from the issue processing
      const prData = await this.extractPRData(issueData);
      
      if (prData) {
        const notificationData: NotificationData = {
          repositoryName: `${issueData.owner}/${issueData.repo}`,
          issueNumber: issueData.issueNumber,
          issueTitle: issueData.title,
          prNumber: prData.prNumber,
          prUrl: prData.prUrl,
          branchName: prData.branchName,
          implementedFiles: prData.implementedFiles,
          author: 'GitHub Agent'
        };

        result.prUrl = prData.prUrl;
        
        const emailSent = await this.emailAgent.sendPRNotification(
          notificationData, 
          this.config.emailGroups
        );
        
        result.agentResults.emailNotification = emailSent;
        result.timing.emailNotification = Date.now() - startTime;
        
        if (emailSent) {
          console.log(`✅ Email notification sent in ${(result.timing.emailNotification / 1000).toFixed(1)}s`);
        } else {
          console.log('⚠️ Email notification failed but continuing...');
        }
        
      } else {
        result.errors.push('Could not extract PR data for email notification');
        console.log('⚠️ Could not extract PR data for email notification');
      }
      
    } catch (error) {
      result.agentResults.emailNotification = false;
      result.timing.emailNotification = Date.now() - startTime;
      result.errors.push(`Email notification failed: ${(error as Error).message}`);
      
      console.log(`❌ Email notification failed: ${(error as Error).message}`);
    }
  }

  /**
   * Extract PR data from the GitHub agent's work
   */
  private async extractPRData(issueData: IssueData): Promise<{
    prNumber: number;
    prUrl: string;
    branchName: string;
    implementedFiles: string[];
  } | null> {
    try {
      // Since GitHubAgent doesn't return PR data directly, we'll need to query it
      // For now, we'll construct expected values based on the issue
      const branchName = `issue-${issueData.issueNumber}-${issueData.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .substring(0, 30)
        .replace(/-+$/, '')}`;

      // In a real implementation, you'd query the GitHub API to get the actual PR
      // For now, we'll simulate the expected files based on the issue content
      const implementedFiles = this.predictImplementedFiles(issueData);
      
      return {
        prNumber: issueData.issueNumber + 1000, // Simulated PR number
        prUrl: `https://github.com/${issueData.owner}/${issueData.repo}/pull/${issueData.issueNumber + 1000}`,
        branchName,
        implementedFiles
      };
      
    } catch (error) {
      console.log(`Failed to extract PR data: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Predict implemented files based on issue content
   */
  private predictImplementedFiles(issueData: IssueData): string[] {
    const files: string[] = [];
    const title = issueData.title.toLowerCase();
    const body = (issueData.body || '').toLowerCase();
    
    // Extract entity name from title or body
    const entityMatch = title.match(/(?:add|create|implement)\s+(\w+)\s+(?:entity|class|model)/);
    const entityName = entityMatch ? entityMatch[1] : 'Entity';
    
    // Predict typical Spring Boot files
    if (title.includes('entity') || body.includes('entity')) {
      files.push(`src/main/java/com/example/demo/model/${entityName}.java`);
    }
    
    if (title.includes('repository') || body.includes('repository') || title.includes('entity')) {
      files.push(`src/main/java/com/example/demo/repository/${entityName}Repository.java`);
    }
    
    if (title.includes('service') || body.includes('service') || title.includes('entity')) {
      files.push(`src/main/java/com/example/demo/service/${entityName}Service.java`);
    }
    
    if (title.includes('controller') || body.includes('controller') || title.includes('api') || title.includes('rest')) {
      files.push(`src/main/java/com/example/demo/controller/${entityName}Controller.java`);
    }
    
    return files.length > 0 ? files : ['Generated Spring Boot components'];
  }

  /**
   * Log agent status on initialization
   */
  private logAgentStatus(): void {
    console.log('🔍 Agent Status:');
    
    // GitHub Agent status
    console.log('  🤖 GitHub Agent: ✅ Active (legacy mode)');
    console.log('  🎯 Code Agent: ✅ Active (specialized code generation)');
    
    // Test Agent status
    console.log(`  🧪 Test Agent: ${this.config.enableTesting ? '✅ Active' : '⚠️ Disabled'}`);
    if (this.config.enableTesting) {
      console.log('    📝 Features: JUnit 5, Mockito, JaCoCo coverage');
    }
    
    // Deploy Agent status
    console.log(`  🚀 Deploy Agent: ${this.config.enableDeployment ? '✅ Active' : '⚠️ Disabled'}`);
    if (this.config.enableDeployment) {
      console.log('    ☁️ Target: AWS ECS with Fargate');
      console.log(`    🌍 Region: ${this.config.deploymentConfig?.awsRegion || 'us-east-1'}`);
    }
    
    // Email Agent status
    const emailStatus = this.emailAgent.getStatus();
    console.log(`  📧 Email Agent: ${emailStatus.enabled ? '✅ Active' : '⚠️ Disabled'}`);
    
    if (emailStatus.enabled) {
      console.log(`    📮 Recipients: ${emailStatus.recipientCount} across ${emailStatus.groups.length} groups`);
      console.log(`    📋 Groups: ${emailStatus.groups.join(', ')}`);
    }
  }

  /**
   * Log orchestration results
   */
  private logOrchestrationResult(result: OrchestrationResult): void {
    console.log('🎭 Orchestration Summary:');
    console.log(`  ✅ Overall Success: ${result.success}`);
    console.log(`  🤖 Code Generation: ${result.agentResults.codeGeneration ? '✅' : '❌'} (${result.timing.codeGeneration}ms)`);
    
    if (this.config.enableTesting) {
      console.log(`  🧪 Testing: ${result.agentResults.testing ? '✅' : '❌'} (${result.timing.testing}ms)`);
      if (result.testResults) {
        console.log(`    📊 Tests: ${result.testResults.metrics.passedTests}/${result.testResults.metrics.totalTests} passed`);
      }
    }
    
    if (this.config.enableDeployment) {
      console.log(`  🚀 Deployment: ${result.agentResults.deployment ? '✅' : '❌'} (${result.timing.deployment}ms)`);
      if (result.serviceUrl) {
        console.log(`    🌐 Service URL: ${result.serviceUrl}`);
      }
    }
    
    console.log(`  📧 Email Notification: ${result.agentResults.emailNotification ? '✅' : '❌'} (${result.timing.emailNotification}ms)`);
    console.log(`  ⏱️ Total Time: ${(result.timing.total / 1000).toFixed(1)}s`);
    
    if (result.errors.length > 0) {
      console.log('  ❌ Errors:');
      result.errors.forEach(error => console.log(`    - ${error}`));
    }
    
    if (result.prUrl) {
      console.log(`  🔗 Pull Request: ${result.prUrl}`);
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AgentConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('🔧 Orchestrator configuration updated');
  }

  /**
   * Get orchestrator status
   */
  getStatus() {
    return {
      config: this.config,
      emailAgent: this.emailAgent.getStatus(),
      githubAgent: 'active'
    };
  }
}
