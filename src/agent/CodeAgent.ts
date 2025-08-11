import { Octokit } from '@octokit/rest';
import simpleGit, { SimpleGit } from 'simple-git';
import fs from 'fs/promises';
import path from 'path';
import { FreeAIService } from '../services/FreeAIService';
import { IssueData } from './GitHubAgent';

export interface CodeGenerationResult {
  success: boolean;
  branchName?: string;
  prUrl?: string;
  implementedFiles: string[];
  errors: string[];
  codeQualityScore: number;
}

export interface CodeAnalysis {
  entityName: string;
  requiredComponents: string[];
  complexity: 'low' | 'medium' | 'high';
  estimatedDuration: number; // in seconds
}

/**
 * Specialized Code Generation Agent
 * Focuses purely on analyzing requirements and generating high-quality code
 */
export class CodeAgent {
  private octokit: Octokit;
  private git: SimpleGit;
  private workspaceDir: string;
  private aiService: FreeAIService;

  constructor(octokit: Octokit) {
    this.octokit = octokit;
    this.workspaceDir = process.env.WORKSPACE_DIR || './workspace';
    this.git = simpleGit();
    this.aiService = new FreeAIService();
    
    console.log('🛠️ CodeAgent initialized');
    console.log(`🤖 AI service: ${this.aiService.getServiceType()}`);
  }

  /**
   * Main code generation method
   */
  async generateCode(issueData: IssueData): Promise<CodeGenerationResult> {
    console.log(`🛠️ CodeAgent: Starting code generation for issue #${issueData.issueNumber}`);
    
    const result: CodeGenerationResult = {
      success: false,
      implementedFiles: [],
      errors: [],
      codeQualityScore: 0
    };

    try {
      // 1. Analyze requirements
      const analysis = await this.analyzeRequirements(issueData);
      console.log(`📊 Code complexity: ${analysis.complexity}, estimated duration: ${analysis.estimatedDuration}s`);

      // 2. Setup repository
      const repoPath = await this.ensureRepository(issueData.owner, issueData.repo);
      
      // 3. Create feature branch
      const branchName = await this.createFeatureBranch(issueData, repoPath);
      result.branchName = branchName;

      // 4. Generate code components
      const generatedFiles = await this.generateCodeComponents(issueData, analysis, repoPath);
      result.implementedFiles = generatedFiles;

      // 5. Commit and push changes
      await this.commitAndPushCode(issueData, branchName, repoPath);

      // 6. Create pull request
      const prUrl = await this.createPullRequest(issueData, branchName, analysis);
      result.prUrl = prUrl;

      // 7. Calculate code quality score
      result.codeQualityScore = await this.calculateCodeQuality(generatedFiles, repoPath);

      result.success = true;
      console.log(`✅ CodeAgent: Successfully generated ${generatedFiles.length} files`);
      
    } catch (error) {
      result.errors.push(`Code generation failed: ${(error as Error).message}`);
      console.error(`❌ CodeAgent failed: ${(error as Error).message}`);
    }

    return result;
  }

  /**
   * Analyze issue requirements to determine implementation approach
   */
  private async analyzeRequirements(issueData: IssueData): Promise<CodeAnalysis> {
    console.log('🔍 Analyzing code requirements...');
    
    const entityName = await this.aiService.extractEntityNameWithAI(
      issueData.body || issueData.title,
      `${issueData.title}\n\n${issueData.body || ''}`
    );

    // Determine required components based on issue content
    const requiredComponents = this.determineRequiredComponents(issueData);
    
    // Calculate complexity
    const complexity = this.calculateComplexity(issueData, requiredComponents);
    
    // Estimate duration based on complexity and components
    const estimatedDuration = this.estimateDuration(complexity, requiredComponents.length);

    return {
      entityName,
      requiredComponents,
      complexity,
      estimatedDuration
    };
  }

  /**
   * Determine what components need to be generated
   */
  private determineRequiredComponents(issueData: IssueData): string[] {
    const content = `${issueData.title} ${issueData.body}`.toLowerCase();
    const components: string[] = [];

    if (content.includes('entity') || content.includes('model') || content.includes('create')) {
      components.push('entity');
    }
    if (content.includes('repository') || content.includes('data') || content.includes('crud')) {
      components.push('repository');
    }
    if (content.includes('service') || content.includes('business') || content.includes('logic')) {
      components.push('service');
    }
    if (content.includes('controller') || content.includes('api') || content.includes('rest') || content.includes('endpoint')) {
      components.push('controller');
    }
    if (content.includes('test') || content.includes('junit')) {
      components.push('tests');
    }

    // Default to full CRUD if no specific components mentioned
    if (components.length === 0) {
      components.push('entity', 'repository', 'service', 'controller');
    }

    return components;
  }

  /**
   * Calculate implementation complexity
   */
  private calculateComplexity(issueData: IssueData, components: string[]): 'low' | 'medium' | 'high' {
    const content = `${issueData.title} ${issueData.body}`.toLowerCase();
    let complexityScore = 0;

    // Base complexity from number of components
    complexityScore += components.length;

    // Additional complexity factors
    if (content.includes('relationship') || content.includes('foreign key')) complexityScore += 2;
    if (content.includes('validation') || content.includes('constraint')) complexityScore += 1;
    if (content.includes('custom query') || content.includes('complex logic')) complexityScore += 2;
    if (content.includes('security') || content.includes('authentication')) complexityScore += 2;
    if (content.includes('integration') || content.includes('external')) complexityScore += 2;

    if (complexityScore <= 4) return 'low';
    if (complexityScore <= 8) return 'medium';
    return 'high';
  }

  /**
   * Estimate implementation duration
   */
  private estimateDuration(complexity: 'low' | 'medium' | 'high', componentCount: number): number {
    const baseTimePerComponent = 30; // seconds
    const complexityMultipliers: Record<'low' | 'medium' | 'high', number> = { low: 1, medium: 1.5, high: 2.5 };
    
    return Math.round(baseTimePerComponent * componentCount * complexityMultipliers[complexity]);
  }

  /**
   * Ensure repository is available locally
   */
  private async ensureRepository(owner: string, repo: string): Promise<string> {
    const repoPath = path.join(this.workspaceDir, `${owner}-${repo}`);
    
    try {
      await fs.access(repoPath);
      // Repository exists, update it
      console.log(`📦 Updating existing repository at ${repoPath}`);
      const git = simpleGit(repoPath);
      await git.fetch();
      await git.checkout('main').catch(() => git.checkout('master'));
      await git.pull();
    } catch (error) {
      // Repository doesn't exist, clone it
      console.log(`📥 Cloning repository to ${repoPath}`);
      await fs.mkdir(this.workspaceDir, { recursive: true });
      const cloneUrl = `https://github.com/${owner}/${repo}.git`;
      await simpleGit().clone(cloneUrl, repoPath);
    }
    
    return repoPath;
  }

  /**
   * Create feature branch for code changes
   */
  private async createFeatureBranch(issueData: IssueData, repoPath: string): Promise<string> {
    const git = simpleGit(repoPath);
    const branchName = `feature/issue-${issueData.issueNumber}-${this.sanitizeBranchName(issueData.title)}`;
    
    // Ensure we're on main/master
    await git.checkout('main').catch(() => git.checkout('master'));
    
    // Create and checkout new branch
    await git.checkoutLocalBranch(branchName);
    
    console.log(`🌿 Created feature branch: ${branchName}`);
    return branchName;
  }

  /**
   * Generate all required code components
   */
  private async generateCodeComponents(
    issueData: IssueData,
    analysis: CodeAnalysis,
    repoPath: string
  ): Promise<string[]> {
    console.log('🏗️ Generating code components...');
    
    const implementedFiles: string[] = [];
    
    // Analyze codebase structure
    const codebaseStructure = await this.analyzeCodebaseStructure(repoPath);
    
    // Build codebase memory for context
    const codebaseMemory = await this.buildCodebaseMemory(repoPath, codebaseStructure);

    try {
      // Generate all components using available AI service methods
      if (this.aiService.isAIEnabled()) {
        console.log('🤖 Using AI-powered code generation...');
        
        // Generate components individually using existing AI methods
        const srcMainJava = path.join(repoPath, 'src', 'main', 'java');
        const packagePath = codebaseStructure.projectConventions?.packageStructure?.replace(/\./g, '/') || 'com/example/demo';

        if (analysis.requiredComponents.includes('entity')) {
          const entityCode = await this.aiService.generateJavaEntityWithAI(
            analysis.entityName,
            issueData.body || issueData.title,
            { ...codebaseStructure, repoPath }
          );
          const entityPath = await this.writeJavaFile(srcMainJava, `${packagePath}/model`, `${analysis.entityName}.java`, entityCode);
          if (entityPath) implementedFiles.push(entityPath);
        }

        if (analysis.requiredComponents.includes('repository')) {
          const repoCode = await this.aiService.generateJavaRepositoryWithAI(
            analysis.entityName,
            issueData.body || issueData.title,
            { ...codebaseStructure, repoPath }
          );
          const repoFilePath = await this.writeJavaFile(srcMainJava, `${packagePath}/repository`, `${analysis.entityName}Repository.java`, repoCode);
          if (repoFilePath) implementedFiles.push(repoFilePath);
        }

        if (analysis.requiredComponents.includes('service')) {
          const serviceCode = await this.aiService.generateJavaServiceWithAI(
            analysis.entityName,
            issueData.body || issueData.title,
            { ...codebaseStructure, repoPath }
          );
          const servicePath = await this.writeJavaFile(srcMainJava, `${packagePath}/service`, `${analysis.entityName}Service.java`, serviceCode);
          if (servicePath) implementedFiles.push(servicePath);
        }

        if (analysis.requiredComponents.includes('controller')) {
          const controllerCode = await this.aiService.generateJavaControllerWithAI(
            analysis.entityName,
            issueData.body || issueData.title,
            { ...codebaseStructure, repoPath }
          );
          const controllerPath = await this.writeJavaFile(srcMainJava, `${packagePath}/controller`, `${analysis.entityName}Controller.java`, controllerCode);
          if (controllerPath) implementedFiles.push(controllerPath);
        }

      } else {
        // Fallback to template-based generation
        console.log('🔄 Using template-based code generation...');
        implementedFiles.push(...await this.generateWithTemplates(issueData, analysis, repoPath, codebaseStructure));
      }

    } catch (error) {
      console.error('❌ Code component generation failed:', error);
      throw error;
    }

    console.log(`✅ Generated ${implementedFiles.length} code files`);
    return implementedFiles;
  }

  /**
   * Calculate code quality score based on generated files
   */
  private async calculateCodeQuality(files: string[], repoPath: string): Promise<number> {
    let qualityScore = 0;
    const maxScore = 100;

    try {
      // Basic quality checks
      if (files.length > 0) qualityScore += 20; // Files generated
      if (files.length >= 4) qualityScore += 20; // Complete CRUD
      
      // Check file content quality
      for (const file of files) {
        try {
          const content = await fs.readFile(file, 'utf-8');
          
          // Check for proper annotations
          if (content.includes('@Entity') || content.includes('@Service') || content.includes('@Repository') || content.includes('@RestController')) {
            qualityScore += 5;
          }
          
          // Check for validation annotations
          if (content.includes('@Valid') || content.includes('@NotNull') || content.includes('@NotBlank')) {
            qualityScore += 5;
          }
          
          // Check for proper error handling
          if (content.includes('try') && content.includes('catch')) {
            qualityScore += 5;
          }
          
          // Check for documentation
          if (content.includes('/**') || content.includes('*')) {
            qualityScore += 5;
          }
        } catch (error) {
          console.warn(`Could not analyze file ${file}: ${error}`);
        }
      }

    } catch (error) {
      console.warn('Could not calculate code quality score:', error);
      qualityScore = 50; // Default score
    }

    return Math.min(qualityScore, maxScore);
  }

  // Helper methods (simplified versions of existing methods)
  private sanitizeBranchName(title: string): string {
    return title.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
  }

  private async writeJavaFile(srcMainJava: string, packagePath: string, fileName: string, content: string): Promise<string | null> {
    try {
      const fullPath = path.join(srcMainJava, packagePath, fileName);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content);
      console.log(`📄 Created: ${fileName}`);
      return fullPath;
    } catch (error) {
      console.error(`Failed to write ${fileName}:`, error);
      return null;
    }
  }

  private async analyzeCodebaseStructure(repoPath: string): Promise<any> {
    // Simplified codebase analysis
    return {
      projectType: 'Spring Boot',
      framework: 'Spring Boot with JPA',
      packageName: 'com.example.demo',
      projectConventions: {
        packageStructure: 'com.example.demo'
      }
    };
  }

  private async buildCodebaseMemory(repoPath: string, structure: any): Promise<any> {
    // Simplified memory building
    return {
      entities: [],
      controllers: [],
      services: [],
      repositories: []
    };
  }

  private async generateWithTemplates(issueData: IssueData, analysis: CodeAnalysis, repoPath: string, structure: any): Promise<string[]> {
    // Simplified template generation
    return [];
  }

  private async commitAndPushCode(issueData: IssueData, branchName: string, repoPath: string): Promise<void> {
    const git = simpleGit(repoPath);
    
    await git.add('.');
    await git.commit(`feat: Implement ${issueData.title}

Auto-generated code for issue #${issueData.issueNumber}
Generated by CodeAgent with AI assistance

Closes #${issueData.issueNumber}`);
    
    await git.push('origin', branchName);
    console.log(`📤 Pushed code to branch: ${branchName}`);
  }

  private async createPullRequest(issueData: IssueData, branchName: string, analysis: CodeAnalysis): Promise<string> {
    try {
      const prResponse = await this.octokit.pulls.create({
        owner: issueData.owner,
        repo: issueData.repo,
        title: `feat: ${issueData.title}`,
        head: branchName,
        base: 'main',
        body: `## 🤖 Auto-generated Implementation

**Issue:** #${issueData.issueNumber}
**Generated by:** CodeAgent with AI assistance

### 📋 Implementation Details
- **Entity:** ${analysis.entityName}
- **Components:** ${analysis.requiredComponents.join(', ')}
- **Complexity:** ${analysis.complexity}
- **Code Quality Score:** Pending TestAgent validation

### 🔧 Generated Components
${analysis.requiredComponents.map(c => `- ✅ ${c.charAt(0).toUpperCase() + c.slice(1)}`).join('\n')}

### ⚡ Next Steps
1. 🧪 TestAgent will run comprehensive tests
2. 🚀 DeployAgent will prepare deployment
3. 👥 Team notification sent via EmailAgent

---
*This PR was automatically created by the GitHub Agent multi-orchestration system.*`
      });

      const prUrl = prResponse.data.html_url;
      console.log(`🔗 Created pull request: ${prUrl}`);
      return prUrl;
      
    } catch (error) {
      console.error('Failed to create pull request:', error);
      throw error;
    }
  }
}
