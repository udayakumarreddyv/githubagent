import { MultiAgentOrchestrator, AgentConfig } from './src/agent/MultiAgentOrchestrator';
import { GitHubAgent } from './src/agent/GitHubAgent';
import { Octokit } from '@octokit/rest';

/**
 * Demo script showing the expanded multi-agent orchestration
 * Now includes CodeAgent, TestAgent, and DeployAgent
 */
async function demonstrateMultiAgentOrchestration() {
  console.log('🎭 Multi-Agent Orchestration Demo');
  console.log('=====================================');
  
  // Setup GitHub configuration
  const githubToken = process.env.GITHUB_TOKEN || 'your-github-token';
  const octokit = new Octokit({ auth: githubToken });
  
  // Create agents
  const githubAgent = new GitHubAgent(octokit);
  
  // Configure multi-agent orchestration
  const config: Partial<AgentConfig> = {
    enableEmailNotifications: true,
    enableTesting: true,          // Enable JUnit testing
    enableDeployment: false,      // Disable deployment for demo (enable for actual AWS deployment)
    emailGroups: ['developers', 'qa-team'],
    deploymentConfig: {
      awsRegion: 'us-east-1',
      serviceName: 'demo-app',
      environment: 'dev',
      containerPort: 8080,
      cpu: '256',
      memory: '512',
      desiredCount: 1
    },
    timeout: 20 * 60 * 1000 // 20 minutes
  };
  
  // Initialize orchestrator
  const orchestrator = new MultiAgentOrchestrator(githubAgent, config);
  
  // Demo issue data
  const demoIssue = {
    issueNumber: 123,
    title: 'Create Vehicle entity with CRUD operations',
    body: `
Please implement a Vehicle entity with the following requirements:
- Vehicle should have properties: id, make, model, year, color, licensePlate
- Include full CRUD operations
- Add validation for required fields
- Include repository, service, and REST controller
- Add proper error handling
    `,
    owner: 'udayakumarreddyv',
    repo: 'GHCP-Demo',
    creator: 'demo-user',
    labels: ['enhancement', 'backend']
  };
  
  console.log('\n🚀 Starting orchestration with specialized agents:');
  console.log('  🎯 CodeAgent: Focused code generation with quality metrics');
  console.log('  🧪 TestAgent: JUnit test generation and execution');
  console.log('  🚀 DeployAgent: AWS ECS deployment (disabled for demo)');
  console.log('  📧 EmailAgent: Team notifications');
  
  try {
    // Execute the orchestration
    const result = await orchestrator.orchestrateIssueProcessing(demoIssue);
    
    console.log('\n📊 Final Results:');
    console.log('==================');
    console.log(`✅ Overall Success: ${result.success}`);
    console.log(`🤖 Code Generation: ${result.agentResults.codeGeneration ? 'Success' : 'Failed'}`);
    console.log(`🧪 Testing: ${result.agentResults.testing ? 'Success' : 'Failed'}`);
    console.log(`🚀 Deployment: ${result.agentResults.deployment ? 'Success' : 'Skipped'}`);
    console.log(`📧 Email Notification: ${result.agentResults.emailNotification ? 'Success' : 'Failed'}`);
    
    if (result.testResults) {
      console.log(`\n🧪 Test Summary:`);
      console.log(`  Total Tests: ${result.testResults.metrics.totalTests}`);
      console.log(`  Passed: ${result.testResults.metrics.passedTests}`);
      console.log(`  Failed: ${result.testResults.metrics.failedTests}`);
      console.log(`  Generated Test Files: ${result.testResults.generatedTestFiles.length}`);
    }
    
    if (result.deploymentResults) {
      console.log(`\n🚀 Deployment Summary:`);
      console.log(`  Success: ${result.deploymentResults.success}`);
      console.log(`  Service URL: ${result.deploymentResults.serviceUrl}`);
      console.log(`  Deployment Time: ${result.deploymentResults.deploymentTime}ms`);
    }
    
    console.log(`\n⏱️ Total Execution Time: ${(result.timing.total / 1000).toFixed(1)}s`);
    
    if (result.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      result.errors.forEach(error => console.log(`  - ${error}`));
    }
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
  }
}

/**
 * Demo configuration variations
 */
function demonstrateConfigurationOptions() {
  console.log('\n🔧 Configuration Examples:');
  console.log('==========================');
  
  console.log('\n1. 🧪 Testing-focused configuration:');
  const testingConfig: Partial<AgentConfig> = {
    enableTesting: true,
    enableDeployment: false,
    enableEmailNotifications: true
  };
  console.log(JSON.stringify(testingConfig, null, 2));
  
  console.log('\n2. 🚀 Full CI/CD pipeline configuration:');
  const fullPipelineConfig: Partial<AgentConfig> = {
    enableTesting: true,
    enableDeployment: true,
    enableEmailNotifications: true,
    deploymentConfig: {
      awsRegion: 'us-west-2',
      serviceName: 'production-app',
      environment: 'prod',
      containerPort: 8080,
      cpu: '1024',
      memory: '2048',
      desiredCount: 3
    }
  };
  console.log(JSON.stringify(fullPipelineConfig, null, 2));
  
  console.log('\n3. 🏃‍♂️ Quick development configuration:');
  const quickDevConfig: Partial<AgentConfig> = {
    enableTesting: false,
    enableDeployment: false,
    enableEmailNotifications: false
  };
  console.log(JSON.stringify(quickDevConfig, null, 2));
}

// Run the demo
if (require.main === module) {
  demonstrateMultiAgentOrchestration()
    .then(() => {
      demonstrateConfigurationOptions();
      console.log('\n🎉 Demo completed!');
    })
    .catch(console.error);
}

export { demonstrateMultiAgentOrchestration, demonstrateConfigurationOptions };
