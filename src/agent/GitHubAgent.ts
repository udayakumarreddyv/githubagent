import { Octokit } from '@octokit/rest';
import simpleGit, { SimpleGit } from 'simple-git';
import fs from 'fs/promises';
import path from 'path';
import { FreeAIService } from '../services/FreeAIService';

export interface IssueData {
  owner: string;
  repo: string;
  issueNumber: number;
  title: string;
  body: string;
  labels: string[];
}

export class GitHubAgent {
  private octokit: Octokit;
  private git: SimpleGit;
  private workspaceDir: string;
  private aiService: FreeAIService;

  constructor(octokit: Octokit) {
    this.octokit = octokit;
    this.workspaceDir = process.env.WORKSPACE_DIR || './workspace';
    this.git = simpleGit();
    
    // Initialize Free AI service (multiple free options supported)
    this.aiService = new FreeAIService();
    console.log(`🤖 AI service initialized: ${this.aiService.getServiceType()}`);
  }

  /**
   * Main method to handle a GitHub issue
   */
  async handleIssue(issueData: IssueData): Promise<void> {
    console.log(`🔍 Processing issue #${issueData.issueNumber}: ${issueData.title}`);
    
    try {
      // 1. Clone/update repository
      const repoPath = await this.ensureRepository(issueData.owner, issueData.repo);
      
      // 2. Analyze the issue and generate solution
      const solution = await this.analyzeIssue(issueData);
      
      // 3. Create a new branch
      const branchName = await this.createBranch(issueData, repoPath);
      
      // 4. Implement the changes (pass original issue data)
      await this.implementChanges(solution, repoPath, issueData);
      
      // 5. Commit and push changes
      await this.commitAndPush(issueData, branchName, repoPath);
      
      // 6. Create a pull request
      await this.createPullRequest(issueData, branchName, solution);
      
      // 7. Clean up workspace folder after successful processing
      await this.cleanupWorkspace(issueData.owner, issueData.repo);
      
      console.log(`✅ Successfully processed issue #${issueData.issueNumber}`);
    } catch (error) {
      console.error(`❌ Error processing issue #${issueData.issueNumber}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      await this.commentOnIssue(issueData, `❌ Error processing this issue: ${errorMessage}`);
      
      // Clean up workspace even on error to prevent accumulation
      try {
        await this.cleanupWorkspace(issueData.owner, issueData.repo);
      } catch (cleanupError) {
        console.error(`⚠️ Failed to cleanup workspace:`, cleanupError);
      }
    }
  }

  /**
   * Ensure the repository is available locally
   */
  private async ensureRepository(owner: string, repo: string): Promise<string> {
    const repoPath = path.join(this.workspaceDir, `${owner}-${repo}`);
    
    try {
      await fs.access(repoPath);
      // Repository exists, update it
      const git = simpleGit(repoPath);
      await git.fetch();
      await git.checkout('main').catch(() => git.checkout('master'));
      await git.pull();
      console.log(`📦 Updated existing repository at ${repoPath}`);
    } catch (error) {
      // Repository doesn't exist, clone it
      await fs.mkdir(this.workspaceDir, { recursive: true });
      const cloneUrl = `https://github.com/${owner}/${repo}.git`;
      await simpleGit().clone(cloneUrl, repoPath);
      console.log(`📥 Cloned repository to ${repoPath}`);
    }
    
    return repoPath;
  }

  /**
   * Analyze the issue and generate a solution plan
   */
  private async analyzeIssue(issueData: IssueData): Promise<string> {
    console.log(`🔍 Analyzing issue: ${issueData.title}`);
    
    // Read the repository structure to understand the codebase
    const repoPath = path.join(this.workspaceDir, `${issueData.owner}-${issueData.repo}`);
    const codebaseStructure = await this.analyzeCodebaseStructure(repoPath);
    
    console.log(`📁 Found ${codebaseStructure.files.length} code files`);
    console.log(`🏗️ Detected project type: ${codebaseStructure.projectType}`);
    
    // Read existing codebase as memory/context
    const codebaseMemory = await this.buildCodebaseMemory(repoPath, codebaseStructure);
    
    // Use Free AI for intelligent analysis if available
    if (this.aiService.isAIEnabled()) {
      console.log(`🤖 Using ${this.aiService.getServiceType()} AI for intelligent analysis...`);
      try {
        const aiAnalysis = await this.aiService.analyzeIssueWithAI(issueData, {
          ...codebaseStructure,
          entities: codebaseMemory.entities,
          controllers: codebaseMemory.controllers,
          repoPath: repoPath  // Add repository path for documentation reading
        });
        
        // Parse AI response and generate code
        const generatedFiles = await this.generateCodeWithAI(issueData, codebaseStructure, codebaseMemory, repoPath, aiAnalysis);
        
        return `## 🤖 AI-Generated Implementation for Issue #${issueData.issueNumber}

### AI Analysis:
${aiAnalysis}

### Generated Files:
${generatedFiles.map((file: any) => `- ${file.path} (${file.type})`).join('\n')}

### Summary:
- AI Analysis: ✅ Completed with AI Tools
- Files Generated: ${generatedFiles.length}
- Project Type: ${codebaseStructure.projectType}
- Framework: ${codebaseStructure.framework}
`;
      } catch (error) {
        console.error('❌ AI analysis failed, falling back to template-based approach:', error);
        // Fall back to original template-based approach
      }
    }
    
    // Fallback to original template-based approach
    console.log('📝 Using template-based analysis...');
    const analysis = await this.generateIntelligentAnalysis(issueData, codebaseStructure, codebaseMemory);
    
    // Generate code files based on the analysis
    const generatedFiles = await this.generateCodeFromAnalysis(issueData, codebaseStructure, codebaseMemory, repoPath);
    
    // Return summary of what was generated
    const summary = `
## 🚀 Generated Files for Issue #${issueData.issueNumber}

### Files Created:
${generatedFiles.map((file: any) => `- ${file.path}`).join('\n')}

### Summary:
- Total files generated: ${generatedFiles.length}
- Project type: ${codebaseStructure.projectType}
- Framework: ${codebaseStructure.framework}

### Analysis Context:
${analysis.substring(0, 500)}...
`;

    return summary;
  }

  /**
   * Analyze the codebase structure and identify project type
   */
  private async analyzeCodebaseStructure(repoPath: string): Promise<any> {
    const structure = {
      projectType: 'unknown',
      language: 'unknown',
      framework: 'unknown',
      files: [] as string[],
      mainFiles: [] as string[],
      testFiles: [] as string[],
      configFiles: [] as string[],
      packageFiles: [] as string[],
      projectConventions: {
        usesJakarta: false,
        entityIdType: 'Long',
        packageStructure: '',
        annotationStyle: 'standard'
      }
    };

    try {
      // Read package.json or pom.xml to determine project type
      const packageJsonPath = path.join(repoPath, 'package.json');
      const pomXmlPath = path.join(repoPath, 'pom.xml');
      const requirementsPath = path.join(repoPath, 'requirements.txt');

      if (await this.fileExists(packageJsonPath)) {
        structure.projectType = 'nodejs';
        structure.language = 'javascript/typescript';
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
        
        // Detect framework
        if (packageJson.dependencies?.react || packageJson.devDependencies?.react) {
          structure.framework = 'react';
        } else if (packageJson.dependencies?.express) {
          structure.framework = 'express';
        } else if (packageJson.dependencies?.['@angular/core']) {
          structure.framework = 'angular';
        }
        
        structure.packageFiles.push('package.json');
      } else if (await this.fileExists(pomXmlPath)) {
        structure.projectType = 'maven';
        structure.language = 'java';
        structure.framework = 'spring-boot'; // Assume Spring Boot for Java projects
        structure.packageFiles.push('pom.xml');
        
        // Detect Java/Spring conventions
        await this.detectJavaConventions(repoPath, structure);
      } else if (await this.fileExists(requirementsPath)) {
        structure.projectType = 'python';
        structure.language = 'python';
        structure.packageFiles.push('requirements.txt');
      }

      // Scan for source files
      await this.scanDirectory(repoPath, structure, '');

      return structure;
    } catch (error) {
      console.error('Error analyzing codebase structure:', error);
      return structure;
    }
  }

  /**
   * Detect Java project conventions by analyzing existing code
   */
  private async detectJavaConventions(repoPath: string, structure: any): Promise<void> {
    try {
      // Check pom.xml for Jakarta vs javax
      const pomXmlPath = path.join(repoPath, 'pom.xml');
      if (await this.fileExists(pomXmlPath)) {
        const pomContent = await fs.readFile(pomXmlPath, 'utf8');
        
        // Check for Jakarta EE dependencies
        if (pomContent.includes('jakarta.persistence') || 
            pomContent.includes('spring-boot-starter-data-jpa') ||
            pomContent.includes('jakarta.validation')) {
          structure.projectConventions.usesJakarta = true;
        }
        
        // Check Spring Boot version (3.x uses Jakarta, 2.x uses javax)
        const springBootVersionMatch = pomContent.match(/<spring-boot\.version>(\d+)\./);
        if (springBootVersionMatch && parseInt(springBootVersionMatch[1]) >= 3) {
          structure.projectConventions.usesJakarta = true;
        }
      }
      
      // Scan existing Java files to detect conventions
      for (const file of structure.mainFiles.slice(0, 5)) { // Check first 5 files
        if (file.endsWith('.java')) {
          try {
            const filePath = path.join(repoPath, file);
            const content = await fs.readFile(filePath, 'utf8');
            
            // Detect Jakarta vs javax imports
            if (content.includes('import jakarta.persistence')) {
              structure.projectConventions.usesJakarta = true;
            }
            
            // Detect entity ID type
            if (content.includes('@GeneratedValue') && content.includes('private Long id')) {
              structure.projectConventions.entityIdType = 'Long';
            } else if (content.includes('private Integer id')) {
              structure.projectConventions.entityIdType = 'Integer';
            } else if (content.includes('private String id')) {
              structure.projectConventions.entityIdType = 'String';
            }
            
            // Detect package structure
            const packageMatch = content.match(/package\s+([\w\.]+)/);
            if (packageMatch && !structure.projectConventions.packageStructure) {
              structure.projectConventions.packageStructure = packageMatch[1];
            }
          } catch (error) {
            // Skip files that can't be read
          }
        }
      }
      
      console.log(`🔧 Java conventions detected: Jakarta=${structure.projectConventions.usesJakarta}, ID type=${structure.projectConventions.entityIdType}`);
      
    } catch (error) {
      console.warn('Could not detect Java conventions:', error);
      // Keep defaults
    }
  }

  /**
   * Recursively scan directory for code files
   */
  private async scanDirectory(dirPath: string, structure: any, relativePath: string): Promise<void> {
    try {
      const items = await fs.readdir(dirPath);
      
      for (const item of items) {
        // Skip node_modules, .git, target, etc.
        if (['node_modules', '.git', 'target', 'dist', 'build', '.vscode'].includes(item)) {
          continue;
        }

        const fullPath = path.join(dirPath, item);
        const relativeFilePath = path.join(relativePath, item);
        const stat = await fs.stat(fullPath);

        if (stat.isDirectory()) {
          await this.scanDirectory(fullPath, structure, relativeFilePath);
        } else {
          const ext = path.extname(item).toLowerCase();
          
          // Categorize files
          if (['.js', '.ts', '.jsx', '.tsx', '.java', '.py', '.cs', '.cpp', '.c', '.php'].includes(ext)) {
            structure.files.push(relativeFilePath);
            
            if (item.includes('test') || item.includes('spec') || relativeFilePath.includes('test')) {
              structure.testFiles.push(relativeFilePath);
            } else {
              structure.mainFiles.push(relativeFilePath);
            }
          } else if (['.json', '.xml', '.yml', '.yaml', '.properties', '.config'].includes(ext)) {
            structure.configFiles.push(relativeFilePath);
          }
        }
      }
    } catch (error) {
      // Directory might not be accessible, skip it
    }
  }

  /**
   * Build comprehensive codebase memory for context
   */
  private async buildCodebaseMemory(repoPath: string, codebaseStructure: any): Promise<any> {
    console.log('🧠 Building codebase memory...');
    
    const memory = {
      projectType: codebaseStructure.projectType,
      language: codebaseStructure.language,
      framework: codebaseStructure.framework,
      entities: [] as any[],
      controllers: [] as any[],
      services: [] as any[],
      repositories: [] as any[],
      patterns: {
        namingConventions: [] as string[],
        annotationStyles: [] as string[],
        methodPatterns: [] as string[],
        packageStructure: ''
      },
      domainConcepts: [] as string[],
      businessLogic: [] as string[]
    };

    try {
      // Read key files to understand the domain and patterns
      for (const file of codebaseStructure.mainFiles.slice(0, 10)) {
        try {
          const filePath = path.join(repoPath, file);
          const content = await fs.readFile(filePath, 'utf8');
          
          // Extract domain concepts and patterns
          this.extractDomainConcepts(file, content, memory);
          this.extractCodePatterns(file, content, memory);
          
          // Categorize files
          if (file.includes('model') || file.includes('entity')) {
            memory.entities.push({
              name: path.basename(file, '.java'),
              path: file,
              content: content.substring(0, 1000), // First 1000 chars for context
              fields: this.extractFields(content),
              relationships: this.extractRelationships(content)
            });
          } else if (file.includes('Controller')) {
            memory.controllers.push({
              name: path.basename(file, '.java'),
              path: file,
              endpoints: this.extractEndpoints(content),
              requestMethods: this.extractRequestMethods(content)
            });
          } else if (file.includes('Service')) {
            memory.services.push({
              name: path.basename(file, '.java'),
              path: file,
              methods: this.extractServiceMethods(content)
            });
          } else if (file.includes('Repository')) {
            memory.repositories.push({
              name: path.basename(file, '.java'),
              path: file,
              queryMethods: this.extractQueryMethods(content)
            });
          }
        } catch (error) {
          // Skip files that can't be read
        }
      }

      console.log(`🧠 Memory built: ${memory.entities.length} entities, ${memory.controllers.length} controllers, ${memory.services.length} services`);
      console.log(`🧠 Domain concepts: ${memory.domainConcepts.slice(0, 5).join(', ')}`);
      
      return memory;
    } catch (error) {
      console.warn('Could not fully build codebase memory:', error);
      return memory;
    }
  }

  /**
   * Extract domain concepts from code content
   */
  private extractDomainConcepts(fileName: string, content: string, memory: any): void {
    // Extract class names, field names, method names as domain concepts
    const classMatches = content.match(/class\s+(\w+)/g);
    const fieldMatches = content.match(/private\s+\w+\s+(\w+)/g);
    const methodMatches = content.match(/public\s+\w+\s+(\w+)\(/g);

    if (classMatches) {
      classMatches.forEach(match => {
        const className = match.replace(/class\s+/, '');
        if (!memory.domainConcepts.includes(className)) {
          memory.domainConcepts.push(className);
        }
      });
    }

    if (fieldMatches) {
      fieldMatches.forEach(match => {
        const fieldName = match.replace(/private\s+\w+\s+/, '');
        if (!memory.domainConcepts.includes(fieldName)) {
          memory.domainConcepts.push(fieldName);
        }
      });
    }
  }

  /**
   * Extract code patterns from content
   */
  private extractCodePatterns(fileName: string, content: string, memory: any): void {
    // Extract annotation patterns
    const annotations = content.match(/@\w+/g);
    if (annotations) {
      annotations.forEach(annotation => {
        if (!memory.patterns.annotationStyles.includes(annotation)) {
          memory.patterns.annotationStyles.push(annotation);
        }
      });
    }

    // Extract naming conventions
    const camelCaseMatches = content.match(/\b[a-z][a-zA-Z0-9]*\b/g);
    if (camelCaseMatches && camelCaseMatches.length > 5) {
      memory.patterns.namingConventions.push('camelCase');
    }
  }

  /**
   * Extract field information from entity content
   */
  private extractFields(content: string): string[] {
    const fields: string[] = [];
    const fieldMatches = content.match(/private\s+(\w+)\s+(\w+);/g);
    if (fieldMatches) {
      fieldMatches.forEach(match => {
        const parts = match.match(/private\s+(\w+)\s+(\w+);/);
        if (parts) {
          fields.push(`${parts[2]}: ${parts[1]}`);
        }
      });
    }
    return fields;
  }

  /**
   * Extract relationship information
   */
  private extractRelationships(content: string): string[] {
    const relationships = [];
    const relationMatches = content.match(/@(OneToMany|ManyToOne|OneToOne|ManyToMany)/g);
    if (relationMatches) {
      relationships.push(...relationMatches);
    }
    return relationships;
  }

  /**
   * Extract service methods
   */
  private extractServiceMethods(content: string): string[] {
    const methods: string[] = [];
    const methodMatches = content.match(/public\s+\w+\s+(\w+)\(/g);
    if (methodMatches) {
      methodMatches.forEach(match => {
        const methodName = match.replace(/public\s+\w+\s+/, '').replace(/\(/, '');
        methods.push(methodName);
      });
    }
    return methods;
  }

  /**
   * Extract query methods from repository
   */
  private extractQueryMethods(content: string): string[] {
    const methods = [];
    const queryMatches = content.match(/findBy\w+|existsBy\w+|countBy\w+|deleteBy\w+/g);
    if (queryMatches) {
      methods.push(...queryMatches);
    }
    return methods;
  }

  /**
   * Extract request methods from controller
   */
  private extractRequestMethods(content: string): string[] {
    const methods = [];
    const requestMatches = content.match(/@(GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping)/g);
    if (requestMatches) {
      methods.push(...requestMatches);
    }
    return methods;
  }

  /**
   * Generate intelligent analysis using issue as prompt and codebase as memory
   */
  private async generateIntelligentAnalysis(issueData: IssueData, codebaseStructure: any, codebaseMemory: any): Promise<string> {
    console.log('🧠 Generating intelligent analysis with codebase context...');
    
    // Parse the issue content as a detailed prompt
    const requirements = this.parseIssueRequirements(issueData);
    
    // Generate contextual analysis
    const analysis = `
## 🤖 Intelligent Code Analysis for Issue #${issueData.issueNumber}

### 📋 Requirements Analysis
**Title:** ${issueData.title}
**Description:** ${issueData.body}
**Labels:** ${issueData.labels.join(', ')}

### 🔍 Parsed Requirements:
${requirements.map(req => `- ${req}`).join('\n')}

### 🧠 Codebase Context (Memory):
**Project Type:** ${codebaseMemory.projectType} (${codebaseMemory.language})
**Framework:** ${codebaseMemory.framework}

**Existing Domain Entities:**
${codebaseMemory.entities.map((e: any) => `- ${e.name}: [${e.fields.slice(0, 3).join(', ')}]`).join('\n')}

**Existing Controllers:**
${codebaseMemory.controllers.map((c: any) => `- ${c.name}: [${c.requestMethods.slice(0, 3).join(', ')}]`).join('\n')}

**Existing Services:**
${codebaseMemory.services.map((s: any) => `- ${s.name}: [${s.methods.slice(0, 3).join(', ')}]`).join('\n')}

**Domain Concepts Found:**
${codebaseMemory.domainConcepts.slice(0, 10).join(', ')}

**Code Patterns:**
- Annotations: ${codebaseMemory.patterns.annotationStyles.slice(0, 5).join(', ')}
- Naming: ${codebaseMemory.patterns.namingConventions.join(', ')}

### 🎯 Implementation Strategy:
${this.generateImplementationStrategy(issueData, codebaseMemory)}

### 🔧 Recommended Changes:
${this.generateContextualRecommendations(issueData, codebaseMemory)}
    `;

    return analysis;
  }

  /**
   * Parse issue content to extract specific requirements
   */
  private parseIssueRequirements(issueData: IssueData): string[] {
    const requirements = [];
    const fullText = `${issueData.title} ${issueData.body}`.toLowerCase();
    
    // Extract specific requirements
    if (fullText.includes('entity') || fullText.includes('model')) {
      requirements.push('Create new entity/model class');
    }
    if (fullText.includes('api') || fullText.includes('endpoint')) {
      requirements.push('Create REST API endpoints');
    }
    if (fullText.includes('service') || fullText.includes('business logic')) {
      requirements.push('Create service layer with business logic');
    }
    if (fullText.includes('repository') || fullText.includes('database')) {
      requirements.push('Create repository for data access');
    }
    if (fullText.includes('controller')) {
      requirements.push('Create controller with HTTP endpoints');
    }
    
    // Extract field requirements from description
    const fieldMatches = issueData.body.match(/fields?\s*:?\s*([^.!?]*)/gi);
    if (fieldMatches) {
      fieldMatches.forEach(match => {
        requirements.push(`Add fields: ${match.replace(/fields?\s*:?\s*/i, '')}`);
      });
    }

    // Extract specific features mentioned
    const featureWords = ['authentication', 'validation', 'search', 'filter', 'sort', 'pagination'];
    featureWords.forEach(feature => {
      if (fullText.includes(feature)) {
        requirements.push(`Implement ${feature} functionality`);
      }
    });

    return requirements.length > 0 ? requirements : ['General feature implementation based on title and description'];
  }

  /**
   * Generate implementation strategy based on requirements and codebase
   */
  private generateImplementationStrategy(issueData: IssueData, codebaseMemory: any): string {
    const strategy = [];
    const fullText = `${issueData.title} ${issueData.body}`.toLowerCase();
    
    // Determine what needs to be created based on existing patterns
    if (fullText.includes('entity') || fullText.includes('model')) {
      strategy.push(`1. Create entity following existing patterns: ${codebaseMemory.patterns.annotationStyles.slice(0, 3).join(', ')}`);
      strategy.push(`2. Add repository interface extending existing repository patterns`);
      
      if (codebaseMemory.controllers.length > 0) {
        strategy.push(`3. Create REST controller following existing endpoint patterns`);
      }
      if (codebaseMemory.services.length > 0) {
        strategy.push(`4. Create service layer following existing business logic patterns`);
      }
    }

    if (fullText.includes('api') || fullText.includes('endpoint')) {
      strategy.push(`1. Create REST endpoints using existing annotation patterns`);
      strategy.push(`2. Follow existing request/response patterns from: ${codebaseMemory.controllers.map((c: any) => c.name).join(', ')}`);
    }

    return strategy.length > 0 ? strategy.join('\n') : 'Follow existing codebase patterns and conventions';
  }

  /**
   * Generate contextual recommendations
   */
  private generateContextualRecommendations(issueData: IssueData, codebaseMemory: any): string {
    const recommendations = [];
    
    // Base recommendations on existing codebase patterns
    if (codebaseMemory.entities.length > 0) {
      const sampleEntity = codebaseMemory.entities[0];
      recommendations.push(`- Follow entity pattern from ${sampleEntity.name} with fields: ${sampleEntity.fields.slice(0, 2).join(', ')}`);
    }

    if (codebaseMemory.controllers.length > 0) {
      const sampleController = codebaseMemory.controllers[0];
      recommendations.push(`- Follow controller pattern from ${sampleController.name} with methods: ${sampleController.requestMethods.slice(0, 2).join(', ')}`);
    }

    recommendations.push(`- Use consistent naming convention: ${codebaseMemory.patterns.namingConventions.join(', ') || 'camelCase'}`);
    recommendations.push(`- Apply standard annotations: ${codebaseMemory.patterns.annotationStyles.slice(0, 3).join(', ')}`);
    
    // Add specific recommendations based on issue content
    const issueText = issueData.body.toLowerCase();
    if (issueText.includes('crud')) {
      recommendations.push('- Implement full CRUD operations (Create, Read, Update, Delete)');
    }
    if (issueText.includes('validation')) {
      recommendations.push('- Add input validation annotations');
    }

    return recommendations.join('\n');
  }

  /**
   * Generate actual code files based on the intelligent analysis
   */
  private async generateCodeFromAnalysis(issueData: IssueData, codebaseStructure: any, codebaseMemory: any, repoPath: string): Promise<any[]> {
    console.log('🔧 Generating actual code files based on analysis...');
    
    const generatedFiles = [];
    const requirements = this.parseIssueRequirements(issueData);
    
    // Determine what to generate based on issue content and requirements
    const issueText = `${issueData.title} ${issueData.body}`.toLowerCase();
    
    // Extract entity name from issue
    const entityName = this.extractEntityNameFromIssue(issueData);
    console.log(`🎯 Detected entity name: ${entityName}`);
    
    try {
      // Get the source directory path
      const srcMainJava = path.join(repoPath, 'src', 'main', 'java');
      
      // Generate entity if needed
      if (issueText.includes('entity') || issueText.includes('model') || entityName) {
        const entityFile = await this.generateNewJavaEntityWithContext(
          issueData, 
          codebaseStructure, 
          repoPath, 
          srcMainJava
        );
        if (entityFile) {
          generatedFiles.push({
            type: 'entity',
            path: entityFile,
            name: entityName
          });
          console.log(`✅ Generated entity: ${entityFile}`);
        }
      }

      // Generate repository if needed
      if (issueText.includes('repository') || issueText.includes('data access') || entityName) {
        const repositoryFile = await this.generateNewJavaRepositoryWithContext(
          issueData, 
          codebaseStructure, 
          repoPath, 
          srcMainJava
        );
        if (repositoryFile) {
          generatedFiles.push({
            type: 'repository',
            path: repositoryFile,
            name: `${entityName}Repository`
          });
          console.log(`✅ Generated repository: ${repositoryFile}`);
        }
      }

      // Generate service if needed
      if (issueText.includes('service') || issueText.includes('business logic') || 
          (entityName && (issueText.includes('api') || issueText.includes('controller')))) {
        const serviceFile = await this.generateNewJavaServiceWithContext(
          issueData, 
          codebaseStructure, 
          repoPath, 
          srcMainJava
        );
        if (serviceFile) {
          generatedFiles.push({
            type: 'service',
            path: serviceFile,
            name: `${entityName}Service`
          });
          console.log(`✅ Generated service: ${serviceFile}`);
        }
      }

      // Generate controller if needed
      if (issueText.includes('controller') || issueText.includes('api') || issueText.includes('endpoint') ||
          (entityName && issueText.includes('rest'))) {
        const controllerFile = await this.generateNewJavaControllerWithContext(
          issueData, 
          codebaseStructure, 
          repoPath, 
          srcMainJava
        );
        if (controllerFile) {
          generatedFiles.push({
            type: 'controller',
            path: controllerFile,
            name: `${entityName}Controller`
          });
          console.log(`✅ Generated controller: ${controllerFile}`);
        }
      }

      console.log(`🎉 Successfully generated ${generatedFiles.length} files`);
      return generatedFiles;
      
    } catch (error) {
      console.error('❌ Error generating code files:', error);
      return generatedFiles; // Return whatever was generated successfully
    }
  }

  /**
   * Generate code using AI instead of templates
   */
  private async generateCodeWithAI(
    issueData: IssueData, 
    codebaseStructure: any, 
    codebaseMemory: any, 
    repoPath: string,
    aiAnalysis: string
  ): Promise<any[]> {
    console.log('🤖 Generating code using AI...');
    
    const generatedFiles = [];
    
    try {
      // Parse AI analysis to extract entity name and requirements
      const entityName = await this.aiService.extractEntityNameWithAI(issueData.title, issueData.body);
      console.log(`🎯 AI extracted entity name: ${entityName}`);
      
      const srcMainJava = path.join(repoPath, 'src', 'main', 'java');
      const packagePath = codebaseStructure.projectConventions?.packageStructure?.replace(/\./g, '/') || 'com/example/employee';
      
      // Generate entity with AI
      if (this.shouldGenerateEntity(issueData)) {
        const entityCode = await this.aiService.generateJavaEntityWithAI(
          entityName, 
          issueData.body, 
          { ...codebaseStructure, repoPath }
        );
        
        const entityPath = await this.writeJavaFile(
          srcMainJava, 
          `${packagePath}/model`, 
          `${entityName}.java`, 
          entityCode
        );
        
        if (entityPath) {
          generatedFiles.push({ type: 'entity', path: entityPath, name: entityName });
          console.log(`✅ AI generated entity: ${entityPath}`);
        }
      }

      // Generate repository with AI
      if (this.shouldGenerateRepository(issueData)) {
        const repositoryCode = await this.aiService.generateJavaRepositoryWithAI(
          entityName, 
          issueData.body, 
          { ...codebaseStructure, repoPath }
        );
        
        const repositoryPath = await this.writeJavaFile(
          srcMainJava, 
          `${packagePath}/repository`, 
          `${entityName}Repository.java`, 
          repositoryCode
        );
        
        if (repositoryPath) {
          generatedFiles.push({ type: 'repository', path: repositoryPath, name: `${entityName}Repository` });
          console.log(`✅ AI generated repository: ${repositoryPath}`);
        }
      }

      // Generate service with AI
      if (this.shouldGenerateService(issueData)) {
        const serviceCode = await this.aiService.generateJavaServiceWithAI(
          entityName, 
          issueData.body, 
          codebaseStructure
        );
        
        const servicePath = await this.writeJavaFile(
          srcMainJava, 
          `${packagePath}/service`, 
          `${entityName}Service.java`, 
          serviceCode
        );
        
        if (servicePath) {
          generatedFiles.push({ type: 'service', path: servicePath, name: `${entityName}Service` });
          console.log(`✅ AI generated service: ${servicePath}`);
        }
      }

      // Generate controller with AI
      if (this.shouldGenerateController(issueData)) {
        const controllerCode = await this.aiService.generateJavaControllerWithAI(
          entityName, 
          issueData.body, 
          codebaseStructure
        );
        
        const controllerPath = await this.writeJavaFile(
          srcMainJava, 
          `${packagePath}/controller`, 
          `${entityName}Controller.java`, 
          controllerCode
        );
        
        if (controllerPath) {
          generatedFiles.push({ type: 'controller', path: controllerPath, name: `${entityName}Controller` });
          console.log(`✅ AI generated controller: ${controllerPath}`);
        }
      }

      console.log(`🎉 AI generated ${generatedFiles.length} files`);
      return generatedFiles;
      
    } catch (error) {
      console.error('❌ Error in AI code generation:', error);
      return generatedFiles; // Return whatever was generated successfully
    }
  }

  /**
   * Helper methods to determine what to generate based on issue content
   */
  private shouldGenerateEntity(issueData: IssueData): boolean {
    const text = `${issueData.title} ${issueData.body}`.toLowerCase();
    return text.includes('entity') || text.includes('model') || text.includes('create') || text.includes('add');
  }

  private shouldGenerateRepository(issueData: IssueData): boolean {
    const text = `${issueData.title} ${issueData.body}`.toLowerCase();
    return text.includes('repository') || text.includes('data') || text.includes('crud') || text.includes('database');
  }

  private shouldGenerateService(issueData: IssueData): boolean {
    const text = `${issueData.title} ${issueData.body}`.toLowerCase();
    return text.includes('service') || text.includes('business') || text.includes('logic') || text.includes('crud');
  }

  private shouldGenerateController(issueData: IssueData): boolean {
    const text = `${issueData.title} ${issueData.body}`.toLowerCase();
    return text.includes('controller') || text.includes('api') || text.includes('rest') || text.includes('endpoint');
  }

  /**
   * Helper methods to get existing code examples for context
   */
  private async getExistingEntityExample(repoPath: string, codebaseStructure: any): Promise<string | undefined> {
    const entityFiles = codebaseStructure.mainFiles.filter((f: string) => 
      f.includes('/model/') && f.endsWith('.java') && !f.includes('Test')
    );
    
    if (entityFiles.length > 0) {
      try {
        const filePath = path.join(repoPath, entityFiles[0]);
        return await fs.readFile(filePath, 'utf8');
      } catch (error) {
        // Ignore errors
      }
    }
    return undefined;
  }

  private async getExistingRepositoryExample(repoPath: string, codebaseStructure: any): Promise<string | undefined> {
    const repositoryFiles = codebaseStructure.mainFiles.filter((f: string) => 
      f.includes('/repository/') && f.endsWith('.java') && !f.includes('Test')
    );
    
    if (repositoryFiles.length > 0) {
      try {
        const filePath = path.join(repoPath, repositoryFiles[0]);
        return await fs.readFile(filePath, 'utf8');
      } catch (error) {
        // Ignore errors
      }
    }
    return undefined;
  }

  private async getExistingServiceExample(repoPath: string, codebaseStructure: any): Promise<string | undefined> {
    const serviceFiles = codebaseStructure.mainFiles.filter((f: string) => 
      f.includes('/service/') && f.endsWith('.java') && !f.includes('Test')
    );
    
    if (serviceFiles.length > 0) {
      try {
        const filePath = path.join(repoPath, serviceFiles[0]);
        return await fs.readFile(filePath, 'utf8');
      } catch (error) {
        // Ignore errors
      }
    }
    return undefined;
  }

  private async getExistingControllerExample(repoPath: string, codebaseStructure: any): Promise<string | undefined> {
    const controllerFiles = codebaseStructure.mainFiles.filter((f: string) => 
      f.includes('/controller/') && f.endsWith('.java') && !f.includes('Test')
    );
    
    if (controllerFiles.length > 0) {
      try {
        const filePath = path.join(repoPath, controllerFiles[0]);
        return await fs.readFile(filePath, 'utf8');
      } catch (error) {
        // Ignore errors
      }
    }
    return undefined;
  }

  /**
   * Write Java file to the specified location
   */
  private async writeJavaFile(srcMainJava: string, packagePath: string, fileName: string, content: string): Promise<string | null> {
    try {
      const fullDirPath = path.join(srcMainJava, packagePath);
      const fullFilePath = path.join(fullDirPath, fileName);
      
      // Create directory if it doesn't exist
      await fs.mkdir(fullDirPath, { recursive: true });
      
      // Write the file
      await fs.writeFile(fullFilePath, content, 'utf8');
      
      // Verify file was created
      const exists = await this.fileExists(fullFilePath);
      if (exists) {
        return fullFilePath;
      } else {
        console.error(`❌ Failed to create file: ${fullFilePath}`);
        return null;
      }
    } catch (error) {
      console.error(`❌ Error writing file ${fileName}:`, error);
      return null;
    }
  }

  /**
   * Extract entity name from issue title and description
   */
  private extractEntityNameFromIssue(issueData: IssueData): string {
    const fullText = `${issueData.title} ${issueData.body}`;
    
    // Common patterns for entity names - improved to capture the actual entity name
    const patterns = [
      /create\s+(\w+)\s+entity/i,          // "Create Book entity"
      /add\s+(\w+)\s+entity/i,             // "Add Book entity"
      /new\s+(\w+)\s+entity/i,             // "New Book entity"
      /(\w+)\s+entity\s+with/i,            // "Book entity with REST API"
      /(\w+)\s+entity\s+for/i,             // "Book entity for library"
      /implement\s+(\w+)\s+entity/i,       // "Implement Book entity"
      /add\s+(\w+)\s+model/i,              // "Add Book model"
      /create\s+(\w+)\s+model/i,           // "Create Book model"
      /new\s+(\w+)\s+class/i,              // "New Book class"
      /(\w+)\s+model/i,                    // "Book model"
      /for\s+(\w+)\s+management/i,         // "for Book management"
      /manage\s+(\w+)/i,                   // "manage Books"
      /(\w+)\s+crud/i,                     // "Book CRUD"
      /(\w+)\s+api/i,                      // "Book API"
      /(\w+)\s+rest\s+api/i                // "Book REST API"
    ];

    for (const pattern of patterns) {
      const match = fullText.match(pattern);
      if (match && match[1]) {
        let entityName = match[1];
        
        // Skip common verbs and words that shouldn't be entity names
        const skipWords = ['create', 'add', 'new', 'implement', 'manage', 'the', 'and', 'for', 'with', 'entity', 'model', 'class', 'api', 'rest', 'crud'];
        if (skipWords.includes(entityName.toLowerCase())) {
          continue;
        }
        
        // Capitalize first letter and clean up
        entityName = entityName.charAt(0).toUpperCase() + entityName.slice(1).toLowerCase();
        
        // Remove common suffixes if present
        entityName = entityName.replace(/(Entity|Model|Class)$/i, '');
        
        if (entityName.length > 1) {
          console.log(`🎯 Extracted entity name: "${entityName}" from pattern: ${pattern.source}`);
          return entityName;
        }
      }
    }

    // If no pattern matches, try to extract from title more intelligently
    const titleWords = issueData.title.split(/\s+/).filter(word => {
      const cleanWord = word.toLowerCase().replace(/[^a-z]/g, '');
      return cleanWord.length > 2 && 
             !['the', 'and', 'for', 'add', 'new', 'create', 'entity', 'model', 'api', 'with', 'rest', 'crud'].includes(cleanWord);
    });
    
    if (titleWords.length > 0) {
      let entityName = titleWords[0];
      entityName = entityName.charAt(0).toUpperCase() + entityName.slice(1).toLowerCase();
      console.log(`🎯 Fallback entity name: "${entityName}" from title words`);
      return entityName;
    }

    // Default fallback
    console.log('🎯 Using default entity name: "NewEntity"');
    return 'NewEntity';
  }

  /**
   * Generate intelligent code analysis based on issue and codebase
   */
  private async generateCodeAnalysis(issueData: IssueData, codebaseStructure: any): Promise<string> {
    const analysisPrompt = `
## Codebase Analysis for Issue #${issueData.issueNumber}

**Project Type:** ${codebaseStructure.projectType}
**Language:** ${codebaseStructure.language}
**Framework:** ${codebaseStructure.framework}

**Issue Title:** ${issueData.title}
**Issue Description:** ${issueData.body}
**Labels:** ${issueData.labels.join(', ')}

**Codebase Structure:**
- Main files: ${codebaseStructure.mainFiles.slice(0, 10).join(', ')}
- Test files: ${codebaseStructure.testFiles.slice(0, 5).join(', ')}
- Config files: ${codebaseStructure.configFiles.slice(0, 5).join(', ')}

**Analysis & Solution Plan:**
Based on the issue description and codebase structure, this appears to be a ${this.categorizeIssue(issueData)} request.

**Recommended Changes:**
${await this.generateChangeRecommendations(issueData, codebaseStructure)}
    `;

    return analysisPrompt;
  }

  /**
   * Categorize the type of issue
   */
  private categorizeIssue(issueData: IssueData): string {
    const title = issueData.title.toLowerCase();
    const body = issueData.body.toLowerCase();
    const content = `${title} ${body}`;

    if (content.includes('bug') || content.includes('fix') || content.includes('error')) {
      return 'bug fix';
    } else if (content.includes('feature') || content.includes('add') || content.includes('implement')) {
      return 'feature implementation';
    } else if (content.includes('refactor') || content.includes('improve') || content.includes('optimize')) {
      return 'code improvement';
    } else if (content.includes('test') || content.includes('testing')) {
      return 'testing enhancement';
    } else if (content.includes('document') || content.includes('readme')) {
      return 'documentation update';
    }
    
    return 'general enhancement';
  }

  /**
   * Generate specific change recommendations
   */
  private async generateChangeRecommendations(issueData: IssueData, codebaseStructure: any): Promise<string> {
    const recommendations = [];
    const repoPath = path.join(this.workspaceDir, `${issueData.owner}-${issueData.repo}`);

    // Analyze main files to understand current implementation
    for (const file of codebaseStructure.mainFiles.slice(0, 5)) {
      try {
        const filePath = path.join(repoPath, file);
        const content = await fs.readFile(filePath, 'utf8');
        const analysis = this.analyzeFileContent(file, content, issueData);
        if (analysis) {
          recommendations.push(analysis);
        }
      } catch (error) {
        // File might not be readable, skip it
      }
    }

    return recommendations.length > 0 ? recommendations.join('\n') : 'General code improvements needed based on issue description.';
  }

  /**
   * Analyze individual file content for relevance to the issue
   */
  private analyzeFileContent(fileName: string, content: string, issueData: IssueData): string | null {
    const issueKeywords = this.extractKeywords(issueData.title + ' ' + issueData.body);
    const fileKeywords = this.extractKeywords(content);
    
    // Check if file content is relevant to the issue
    const relevanceScore = this.calculateRelevance(issueKeywords, fileKeywords, content);
    
    if (relevanceScore > 0.1) {
      return `- **${fileName}**: Relevant file that may need modifications (relevance: ${Math.round(relevanceScore * 100)}%)`;
    }
    
    return null;
  }

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): string[] {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !['this', 'that', 'with', 'from', 'they', 'have', 'been', 'will', 'would', 'could', 'should'].includes(word));
  }

  /**
   * Calculate relevance between issue keywords and file content
   */
  private calculateRelevance(issueKeywords: string[], fileKeywords: string[], content: string): number {
    let matches = 0;
    let totalKeywords = issueKeywords.length;

    for (const keyword of issueKeywords) {
      if (fileKeywords.includes(keyword) || content.toLowerCase().includes(keyword)) {
        matches++;
      }
    }

    return totalKeywords > 0 ? matches / totalKeywords : 0;
  }

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create a new branch for the issue
   */
  private async createBranch(issueData: IssueData, repoPath: string): Promise<string> {
    const branchName = `issue-${issueData.issueNumber}-${issueData.title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 50)}`;
    
    const git = simpleGit(repoPath);
    await git.checkoutLocalBranch(branchName);
    
    console.log(`🌿 Created branch: ${branchName}`);
    return branchName;
  }

  /**
   * Implement the changes based on the solution
   */
  private async implementChanges(solution: string, repoPath: string, issueData: IssueData): Promise<void> {
    console.log('🔧 Implementing intelligent code changes...');
    
    // Step 1: Deep analysis of the codebase structure and existing patterns
    const codebaseStructure = await this.analyzeCodebaseStructure(repoPath);
    console.log(`📊 Project Analysis: ${codebaseStructure.projectType} (${codebaseStructure.language})`);
    
    // Step 2: Read existing code patterns to understand the project conventions
    const projectContext = await this.readProjectContext(repoPath, codebaseStructure);
    console.log(`📖 Found ${projectContext.existingEntities.length} entities, ${projectContext.existingControllers.length} controllers`);
    
    // Step 3: Generate actual code changes based on project type and context
    const generatedFiles = await this.generateCodeChangesWithContext(issueData, codebaseStructure, projectContext, repoPath);
    
    // Step 4: Only create documentation if no actual code was generated
    if (generatedFiles.length === 0) {
      console.log('⚠️ No code files generated, creating implementation guide...');
      const changelogPath = path.join(repoPath, 'ISSUE_CHANGES.md');
      await fs.writeFile(changelogPath, solution);
    } else {
      console.log(`✅ Generated ${generatedFiles.length} code files: ${generatedFiles.join(', ')}`);
    }
    
    console.log(`✅ Implemented changes in ${repoPath}`);
  }

  /**
   * Read project context to understand existing patterns and structure
   */
  private async readProjectContext(repoPath: string, codebaseStructure: any): Promise<any> {
    const context = {
      existingEntities: [] as any[],
      existingControllers: [] as any[],
      existingServices: [] as any[],
      packageStructure: '',
      projectConventions: {
        usesJakarta: false,
        usesJavax: false,
        springBootVersion: '2.x',
        entityIdType: 'Long'
      }
    };

    try {
      if (codebaseStructure.projectType === 'maven') {
        // Read existing Java files to understand patterns
        const srcMainJava = path.join(repoPath, 'src', 'main', 'java');
        if (await this.fileExists(srcMainJava)) {
          // Find package structure
          context.packageStructure = await this.findJavaPackagePath(srcMainJava);
          
          // Read existing entities
          const modelDir = path.join(srcMainJava, context.packageStructure, 'model');
          if (await this.fileExists(modelDir)) {
            const modelFiles = await fs.readdir(modelDir);
            for (const file of modelFiles.filter(f => f.endsWith('.java'))) {
              const entityPath = path.join(modelDir, file);
              const content = await fs.readFile(entityPath, 'utf8');
              context.existingEntities.push({
                name: file.replace('.java', ''),
                path: entityPath,
                content: content,
                hasId: content.includes('@Id'),
                usesJakarta: content.includes('jakarta.persistence')
              });
            }
          }

          // Read existing controllers
          const controllerDir = path.join(srcMainJava, context.packageStructure, 'controller');
          if (await this.fileExists(controllerDir)) {
            const controllerFiles = await fs.readdir(controllerDir);
            for (const file of controllerFiles.filter(f => f.endsWith('.java'))) {
              const controllerPath = path.join(controllerDir, file);
              const content = await fs.readFile(controllerPath, 'utf8');
              context.existingControllers.push({
                name: file.replace('.java', ''),
                path: controllerPath,
                content: content,
                endpoints: this.extractEndpoints(content)
              });
            }
          }

          // Read existing services
          const serviceDir = path.join(srcMainJava, context.packageStructure, 'service');
          if (await this.fileExists(serviceDir)) {
            const serviceFiles = await fs.readdir(serviceDir);
            for (const file of serviceFiles.filter(f => f.endsWith('.java'))) {
              const servicePath = path.join(serviceDir, file);
              const content = await fs.readFile(servicePath, 'utf8');
              context.existingServices.push({
                name: file.replace('.java', ''),
                path: servicePath,
                content: content
              });
            }
          }

          // Detect conventions
          if (context.existingEntities.some(e => e.usesJakarta)) {
            context.projectConventions.usesJakarta = true;
          } else {
            context.projectConventions.usesJavax = true;
          }
        }
      }

      return context;
    } catch (error) {
      console.warn('Could not fully read project context:', error);
      return context;
    }
  }

  /**
   * Extract REST endpoints from controller content
   */
  private extractEndpoints(content: string): string[] {
    const endpoints = [];
    const patterns = [
      /@GetMapping\s*\(\s*"([^"]+)"/g,
      /@PostMapping\s*\(\s*"([^"]+)"/g,
      /@PutMapping\s*\(\s*"([^"]+)"/g,
      /@DeleteMapping\s*\(\s*"([^"]+)"/g,
      /@RequestMapping\s*\(\s*"([^"]+)"/g
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        endpoints.push(match[1]);
      }
    }

    return endpoints;
  }

  /**
   * Generate code changes with full project context
   */
  private async generateCodeChangesWithContext(issueData: IssueData, codebaseStructure: any, projectContext: any, repoPath: string): Promise<string[]> {
    const generatedFiles: string[] = [];
    
    console.log(`🏗️ Generating ${codebaseStructure.projectType} code with project context...`);

    switch (codebaseStructure.projectType) {
      case 'maven':
        const javaFiles = await this.generateJavaChangesWithContext(issueData, projectContext, repoPath);
        generatedFiles.push(...javaFiles);
        break;
      case 'nodejs':
        const nodeFiles = await this.generateNodeJSChangesWithContext(issueData, projectContext, repoPath);
        generatedFiles.push(...nodeFiles);
        break;
      case 'python':
        const pythonFiles = await this.generatePythonChangesWithContext(issueData, projectContext, repoPath);
        generatedFiles.push(...pythonFiles);
        break;
      default:
        // For unknown project types, still try to generate something useful
        console.log('🤔 Unknown project type, attempting generic code generation...');
        break;
    }

    return generatedFiles;
  }

  /**
   * Generate Java/Spring Boot code changes with project context
   */
  private async generateJavaChangesWithContext(issueData: IssueData, projectContext: any, repoPath: string): Promise<string[]> {
    const generatedFiles: string[] = [];
    console.log('☕ Generating context-aware Java/Spring Boot changes...');

    const srcMainJava = path.join(repoPath, 'src', 'main', 'java');
    
    if (await this.fileExists(srcMainJava)) {
      // Generate new entity if needed
      if (this.shouldAddNewEntity(issueData)) {
        const entityFile = await this.generateNewJavaEntityWithContext(issueData, projectContext, repoPath, srcMainJava);
        if (entityFile) generatedFiles.push(entityFile);
      }
      
      // Generate new controller if needed
      if (this.shouldAddNewController(issueData)) {
        const controllerFile = await this.generateNewJavaControllerWithContext(issueData, projectContext, repoPath, srcMainJava);
        if (controllerFile) generatedFiles.push(controllerFile);
      }

      // Generate new service if needed
      if (this.shouldAddNewService(issueData)) {
        const serviceFile = await this.generateNewJavaServiceWithContext(issueData, projectContext, repoPath, srcMainJava);
        if (serviceFile) generatedFiles.push(serviceFile);
      }

      // Generate repository if needed for new entities
      if (this.shouldAddNewEntity(issueData)) {
        const repositoryFile = await this.generateNewJavaRepositoryWithContext(issueData, projectContext, repoPath, srcMainJava);
        if (repositoryFile) generatedFiles.push(repositoryFile);
      }
    }

    return generatedFiles;
  }

  /**
   * Generate Node.js code changes with project context
   */
  private async generateNodeJSChangesWithContext(issueData: IssueData, projectContext: any, repoPath: string): Promise<string[]> {
    const generatedFiles: string[] = [];
    console.log('🚀 Generating context-aware Node.js changes...');
    
    // Implementation for Node.js with context
    const nodeFiles = await this.generateNodeJSChanges(issueData, repoPath);
    
    return generatedFiles;
  }

  /**
   * Generate Python code changes with project context
   */
  private async generatePythonChangesWithContext(issueData: IssueData, projectContext: any, repoPath: string): Promise<string[]> {
    const generatedFiles: string[] = [];
    console.log('🐍 Generating context-aware Python changes...');
    
    // Implementation for Python with context
    return generatedFiles;
  }

  /**
   * Generate actual code changes based on project type and issue
   */
  private async generateCodeChanges(issueData: IssueData, codebaseStructure: any, repoPath: string): Promise<void> {
    console.log(`🏗️ Generating ${codebaseStructure.projectType} code changes...`);

    switch (codebaseStructure.projectType) {
      case 'maven':
        await this.generateJavaChanges(issueData, codebaseStructure, repoPath);
        break;
      case 'nodejs':
        await this.generateNodeJSChanges(issueData, repoPath);
        break;
      case 'python':
        await this.generatePythonChanges(issueData, codebaseStructure, repoPath);
        break;
      default:
        await this.generateGenericChanges(issueData, codebaseStructure, repoPath);
    }
  }

  /**
   * Generate Java/Spring Boot code changes
   */
  private async generateJavaChanges(issueData: IssueData, codebaseStructure: any, repoPath: string): Promise<void> {
    console.log('☕ Generating Java/Spring Boot changes...');

    // Find the main application structure
    const srcMainJava = path.join(repoPath, 'src', 'main', 'java');
    
    if (await this.fileExists(srcMainJava)) {
      // Look for existing controllers, services, models
      const controllers = codebaseStructure.mainFiles.filter((f: string) => f.includes('Controller'));
      const services = codebaseStructure.mainFiles.filter((f: string) => f.includes('Service'));
      const models = codebaseStructure.mainFiles.filter((f: string) => f.includes('model') || f.includes('entity'));

      // Generate new features based on issue content
      if (this.shouldAddNewEntity(issueData)) {
        await this.generateNewJavaEntity(issueData, repoPath, srcMainJava);
      }
      
      if (this.shouldAddNewController(issueData)) {
        await this.generateNewJavaController(issueData, repoPath, srcMainJava);
      }

      if (this.shouldAddNewService(issueData)) {
        await this.generateNewJavaService(issueData, repoPath, srcMainJava);
      }

      // Update existing files if needed
      await this.updateExistingJavaFiles(issueData, controllers, services, models, repoPath);
    } else {
      console.log('📝 No Java source directory found, creating basic structure...');
      await this.generateGenericChanges(issueData, codebaseStructure, repoPath);
    }
  }

  /**
   * Generate Node.js code changes
   */
  /**
   * Generate Python code changes
   */
  private async generatePythonChanges(issueData: IssueData, codebaseStructure: any, repoPath: string): Promise<void> {
    console.log('🐍 Generating Python changes...');
    await this.generateGenericChanges(issueData, codebaseStructure, repoPath);
  }

  /**
   * Generate generic code changes
   */
  private async generateGenericChanges(issueData: IssueData, codebaseStructure: any, repoPath: string): Promise<void> {
    console.log('📝 Generating generic code changes...');
    
    // Create a new feature file based on issue title
    const featureName = this.sanitizeFileName(issueData.title || 'new-feature');
    const newFeaturePath = path.join(repoPath, `${featureName}-implementation.md`);
    
    const featureContent = `# ${issueData.title}

## Description
${issueData.body}

## Implementation Notes
- This feature was auto-generated based on GitHub issue #${issueData.issueNumber}
- Project type detected: ${codebaseStructure.projectType}
- Language: ${codebaseStructure.language}
- Framework: ${codebaseStructure.framework}

## Files that may need changes:
${codebaseStructure.mainFiles.slice(0, 5).map((f: string) => `- ${f}`).join('\n')}

## Recommended Next Steps:
1. Review the issue requirements carefully
2. Identify which existing files need modification
3. Create new files as needed
4. Add appropriate unit tests
5. Update documentation

## TODO
- [ ] Implement core functionality
- [ ] Add unit tests
- [ ] Update documentation
- [ ] Review and refine implementation
`;

    await fs.writeFile(newFeaturePath, featureContent);
    console.log(`📄 Created implementation guide: ${featureName}-implementation.md`);
  }

  /**
   * Check if issue requires a new entity
   */
  private shouldAddNewEntity(issueData: IssueData): boolean {
    const content = `${issueData.title} ${issueData.body}`.toLowerCase();
    return content.includes('entity') || content.includes('model') || content.includes('add') && (content.includes('table') || content.includes('database'));
  }

  /**
   * Check if issue requires a new controller
   */
  private shouldAddNewController(issueData: IssueData): boolean {
    const content = `${issueData.title} ${issueData.body}`.toLowerCase();
    return content.includes('endpoint') || content.includes('api') || content.includes('controller') || content.includes('rest');
  }

  /**
   * Check if issue requires a new service
   */
  private shouldAddNewService(issueData: IssueData): boolean {
    const content = `${issueData.title} ${issueData.body}`.toLowerCase();
    return content.includes('service') || content.includes('business logic') || content.includes('logic');
  }

  /**
   * Generate a new Java entity
   */
  private async generateNewJavaEntity(issueData: IssueData, repoPath: string, srcMainJava: string): Promise<void> {
    const entityName = this.extractEntityName(issueData.title);
    const packagePath = await this.findJavaPackagePath(srcMainJava);
    const entityPath = path.join(srcMainJava, packagePath, 'model', `${entityName}.java`);

    // Create model directory if it doesn't exist
    await fs.mkdir(path.dirname(entityPath), { recursive: true });

    const entityContent = this.generateJavaEntityCode(entityName, packagePath);
    await fs.writeFile(entityPath, entityContent);
    
    console.log(`📄 Created new entity: ${entityName}.java`);
  }

  /**
   * Generate a new Java controller
   */
  private async generateNewJavaController(issueData: IssueData, repoPath: string, srcMainJava: string): Promise<void> {
    const controllerName = this.extractControllerName(issueData.title);
    const packagePath = await this.findJavaPackagePath(srcMainJava);
    const controllerPath = path.join(srcMainJava, packagePath, 'controller', `${controllerName}Controller.java`);

    // Create controller directory if it doesn't exist
    await fs.mkdir(path.dirname(controllerPath), { recursive: true });

    const controllerContent = this.generateJavaControllerCode(controllerName, packagePath);
    await fs.writeFile(controllerPath, controllerContent);
    
    console.log(`📄 Created new controller: ${controllerName}Controller.java`);
  }

  /**
   * Generate a new Java service
   */
  private async generateNewJavaService(issueData: IssueData, repoPath: string, srcMainJava: string): Promise<void> {
    const serviceName = this.extractServiceName(issueData.title);
    const packagePath = await this.findJavaPackagePath(srcMainJava);
    const servicePath = path.join(srcMainJava, packagePath, 'service', `${serviceName}Service.java`);

    // Create service directory if it doesn't exist
    await fs.mkdir(path.dirname(servicePath), { recursive: true });

    const serviceContent = this.generateJavaServiceCode(serviceName, packagePath);
    await fs.writeFile(servicePath, serviceContent);
    
    console.log(`📄 Created new service: ${serviceName}Service.java`);
  }

  /**
   * Generate a new Java entity with project context
   */
  private async generateNewJavaEntityWithContext(issueData: IssueData, projectContext: any, repoPath: string, srcMainJava: string): Promise<string | null> {
    try {
      const entityName = this.extractEntityName(issueData.title);
      console.log(`🔍 Extracting entity name from "${issueData.title}": ${entityName}`);
      
      const packagePath = projectContext.packageStructure || await this.findJavaPackagePath(srcMainJava);
      console.log(`📦 Using package path: ${packagePath}`);
      
      const entityPath = path.join(srcMainJava, packagePath, 'model', `${entityName}.java`);
      console.log(`📂 Target entity path: ${entityPath}`);

      // Create model directory if it doesn't exist
      await fs.mkdir(path.dirname(entityPath), { recursive: true });
      console.log(`📁 Created directory: ${path.dirname(entityPath)}`);

      // Generate entity with project conventions
      const entityContent = this.generateJavaEntityCodeWithContext(entityName, packagePath, projectContext);
      console.log(`📝 Generated entity content (${entityContent.length} characters)`);
      
      await fs.writeFile(entityPath, entityContent);
      console.log(`💾 Successfully wrote file: ${entityPath}`);
      
      // Verify file was created
      const exists = await this.fileExists(entityPath);
      console.log(`✅ File exists verification: ${exists}`);
      
      console.log(`📄 Created new entity: ${entityName}.java`);
      return `${entityName}.java`;
    } catch (error) {
      console.error('❌ Error generating Java entity:', error);
      return null;
    }
  }

  /**
   * Generate a new Java controller with project context
   */
  private async generateNewJavaControllerWithContext(issueData: IssueData, projectContext: any, repoPath: string, srcMainJava: string): Promise<string | null> {
    try {
      const controllerName = this.extractControllerName(issueData.title);
      const packagePath = projectContext.packageStructure || await this.findJavaPackagePath(srcMainJava);
      const controllerPath = path.join(srcMainJava, packagePath, 'controller', `${controllerName}Controller.java`);

      // Create controller directory if it doesn't exist
      await fs.mkdir(path.dirname(controllerPath), { recursive: true });

      // Generate controller with project conventions
      const controllerContent = this.generateJavaControllerCodeWithContext(controllerName, packagePath, projectContext);
      await fs.writeFile(controllerPath, controllerContent);
      
      console.log(`📄 Created new controller: ${controllerName}Controller.java`);
      return `${controllerName}Controller.java`;
    } catch (error) {
      console.error('Error generating Java controller:', error);
      return null;
    }
  }

  /**
   * Generate a new Java service with project context
   */
  private async generateNewJavaServiceWithContext(issueData: IssueData, projectContext: any, repoPath: string, srcMainJava: string): Promise<string | null> {
    try {
      const serviceName = this.extractServiceName(issueData.title);
      const entityName = this.extractEntityName(issueData.title);
      const packagePath = projectContext.packageStructure || await this.findJavaPackagePath(srcMainJava);
      const servicePath = path.join(srcMainJava, packagePath, 'service', `${serviceName}Service.java`);

      // Create service directory if it doesn't exist
      await fs.mkdir(path.dirname(servicePath), { recursive: true });

      // Generate service with project conventions
      const serviceContent = this.generateJavaServiceCodeWithContext(serviceName, entityName, packagePath, projectContext);
      await fs.writeFile(servicePath, serviceContent);
      
      console.log(`📄 Created new service: ${serviceName}Service.java`);
      return `${serviceName}Service.java`;
    } catch (error) {
      console.error('Error generating Java service:', error);
      return null;
    }
  }

  /**
   * Generate a new Java repository with project context
   */
  private async generateNewJavaRepositoryWithContext(issueData: IssueData, projectContext: any, repoPath: string, srcMainJava: string): Promise<string | null> {
    try {
      const entityName = this.extractEntityName(issueData.title);
      console.log(`🔍 Repository - Extracting entity name from "${issueData.title}": ${entityName}`);
      
      const packagePath = projectContext.packageStructure || await this.findJavaPackagePath(srcMainJava);
      console.log(`📦 Repository - Using package path: ${packagePath}`);
      
      const repositoryPath = path.join(srcMainJava, packagePath, 'repository', `${entityName}Repository.java`);
      console.log(`📂 Target repository path: ${repositoryPath}`);

      // Create repository directory if it doesn't exist
      await fs.mkdir(path.dirname(repositoryPath), { recursive: true });
      console.log(`📁 Created repository directory: ${path.dirname(repositoryPath)}`);

      // Generate repository with project conventions
      const repositoryContent = this.generateJavaRepositoryCodeWithContext(entityName, packagePath, projectContext);
      console.log(`📝 Generated repository content (${repositoryContent.length} characters)`);
      
      await fs.writeFile(repositoryPath, repositoryContent);
      console.log(`💾 Successfully wrote repository file: ${repositoryPath}`);
      
      // Verify file was created
      const exists = await this.fileExists(repositoryPath);
      console.log(`✅ Repository file exists verification: ${exists}`);
      
      console.log(`📄 Created new repository: ${entityName}Repository.java`);
      return `${entityName}Repository.java`;
    } catch (error) {
      console.error('❌ Error generating Java repository:', error);
      return null;
    }
  }

  /**
   * Find Java package path
   */
  private async findJavaPackagePath(srcMainJava: string): Promise<string> {
    try {
      const dirs = await fs.readdir(srcMainJava);
      // Look for com/ directory (common Java package structure)
      if (dirs.includes('com')) {
        const comDirs = await fs.readdir(path.join(srcMainJava, 'com'));
        if (comDirs.length > 0) {
          const orgDirs = await fs.readdir(path.join(srcMainJava, 'com', comDirs[0]));
          if (orgDirs.length > 0) {
            return path.join('com', comDirs[0], orgDirs[0]);
          }
        }
      }
    } catch (error) {
      console.warn('Could not determine Java package path, using default');
    }
    return 'com/example/demo';
  }

  /**
   * Extract entity name from issue title
   */
  private extractEntityName(title: string): string {
    // Simple extraction - could be enhanced with NLP
    const words = title.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    return words.find(w => w.length > 3) || 'NewEntity';
  }

  /**
   * Extract controller name from issue title
   */
  private extractControllerName(title: string): string {
    // Simple extraction - could be enhanced with NLP
    const words = title.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    return words.find(w => w.length > 3) || 'New';
  }

  /**
   * Extract service name from issue title
   */
  private extractServiceName(title: string): string {
    // Simple extraction - could be enhanced with NLP
    const words = title.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    return words.find(w => w.length > 3) || 'New';
  }

  /**
   * Generate Java entity code
   */
  private generateJavaEntityCode(entityName: string, packagePath: string): string {
    const packageName = packagePath.replace(/\//g, '.');
    return `package ${packageName}.model;

import jakarta.persistence.*;

/**
 * ${entityName} entity - Auto-generated by GitHub Agent
 */
@Entity
@Table(name = "${entityName.toLowerCase()}")
public class ${entityName} {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false)
    private String name;
    
    private String description;
    
    // Constructors
    public ${entityName}() {}
    
    public ${entityName}(String name, String description) {
        this.name = name;
        this.description = description;
    }
    
    // Getters and Setters
    public Long getId() {
        return id;
    }
    
    public void setId(Long id) {
        this.id = id;
    }
    
    public String getName() {
        return name;
    }
    
    public void setName(String name) {
        this.name = name;
    }
    
    public String getDescription() {
        return description;
    }
    
    public void setDescription(String description) {
        this.description = description;
    }
}
`;
  }

  /**
   * Generate Java controller code
   */
  private generateJavaControllerCode(controllerName: string, packagePath: string): string {
    const packageName = packagePath.replace(/\//g, '.');
    return `package ${packageName}.controller;

import ${packageName}.service.${controllerName}Service;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * ${controllerName} REST Controller - Auto-generated by GitHub Agent
 */
@RestController
@RequestMapping("/api/${controllerName.toLowerCase()}")
@CrossOrigin(origins = "*")
public class ${controllerName}Controller {
    
    @Autowired
    private ${controllerName}Service ${controllerName.toLowerCase()}Service;
    
    @GetMapping
    public ResponseEntity<?> getAll() {
        return ResponseEntity.ok(${controllerName.toLowerCase()}Service.findAll());
    }
    
    @GetMapping("/{id}")
    public ResponseEntity<?> getById(@PathVariable Long id) {
        return ResponseEntity.ok(${controllerName.toLowerCase()}Service.findById(id));
    }
    
    @PostMapping
    public ResponseEntity<?> create(@RequestBody Object request) {
        return ResponseEntity.ok(${controllerName.toLowerCase()}Service.save(request));
    }
    
    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody Object request) {
        return ResponseEntity.ok(${controllerName.toLowerCase()}Service.update(id, request));
    }
    
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        ${controllerName.toLowerCase()}Service.delete(id);
        return ResponseEntity.ok().build();
    }
}
`;
  }

  /**
   * Generate Java service code
   */
  private generateJavaServiceCode(serviceName: string, packagePath: string): string {
    const packageName = packagePath.replace(/\//g, '.');
    return `package ${packageName}.service;

import org.springframework.stereotype.Service;
import java.util.List;
import java.util.ArrayList;

/**
 * ${serviceName} Service - Auto-generated by GitHub Agent
 */
@Service
public class ${serviceName}Service {
    
    public List<Object> findAll() {
        // TODO: Implement actual data retrieval
        return new ArrayList<>();
    }
    
    public Object findById(Long id) {
        // TODO: Implement actual data retrieval by ID
        return new Object();
    }
    
    public Object save(Object entity) {
        // TODO: Implement actual save logic
        return entity;
    }
    
    public Object update(Long id, Object entity) {
        // TODO: Implement actual update logic
        return entity;
    }
    
    public void delete(Long id) {
        // TODO: Implement actual delete logic
    }
}
`;
  }

  /**
   * Update existing Java files
   */
  private async updateExistingJavaFiles(issueData: any, controllers: string[], services: string[], models: string[], repoPath: string): Promise<void> {
    // This could be enhanced to modify existing files based on issue requirements
    console.log('📝 Checking existing files for potential updates...');
  }

  /**
   * Generate Express.js changes
   */
  private async generateExpressChanges(issueData: any, repoPath: string): Promise<void> {
    console.log('� Generating Express.js changes...');
    // Implementation for Express.js specific changes
  }

  /**
   * Generate React changes
   */
  private async generateReactChanges(issueData: any, repoPath: string): Promise<void> {
    console.log('⚛️ Generating React changes...');
    // Implementation for React specific changes
  }

  /**
   * Extract issue data from solution text
   */
  private extractIssueDataFromSolution(solution: string): any {
    // Extract issue details from the solution text
    const titleMatch = solution.match(/\*\*Title:\*\* (.+)/);
    const descMatch = solution.match(/\*\*Description:\*\* (.+)/);
    
    return {
      title: titleMatch ? titleMatch[1] : 'New Feature',
      body: descMatch ? descMatch[1] : 'Auto-generated feature'
    };
  }

  /**
   * Sanitize filename
   */
  private sanitizeFileName(name: string): string {
    return name.toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Commit and push changes
   */
  private async commitAndPush(issueData: IssueData, branchName: string, repoPath: string): Promise<void> {
    const git = simpleGit(repoPath);
    
    await git.add('.');
    await git.commit(`Fix #${issueData.issueNumber}: ${issueData.title}

Auto-generated solution by GitHub Agent.

Closes #${issueData.issueNumber}`);
    
    await git.push('origin', branchName);
    
    console.log(`📤 Pushed changes to branch: ${branchName}`);
  }

  /**
   * Create a pull request
   */
  private async createPullRequest(issueData: IssueData, branchName: string, solution: string): Promise<void> {
    const prTitle = `Fix #${issueData.issueNumber}: ${issueData.title}`;
    const prBody = `## 🤖 Auto-generated Pull Request

This PR was automatically created by the GitHub Agent to address issue #${issueData.issueNumber}.

${solution}

### Changes Made:
- Analyzed the issue requirements
- Implemented proposed solution
- Added documentation

Closes #${issueData.issueNumber}

---
*This PR was generated automatically. Please review the changes before merging.*`;

    try {
      const { data: pr } = await this.octokit.rest.pulls.create({
        owner: issueData.owner,
        repo: issueData.repo,
        title: prTitle,
        body: prBody,
        head: branchName,
        base: 'main', // Will fallback to 'master' if main doesn't exist
      });

      console.log(`🔗 Created PR #${pr.number}: ${pr.html_url}`);
      
      // Comment on the original issue
      await this.commentOnIssue(issueData, `🤖 I've created a pull request to address this issue: ${pr.html_url}`);
    } catch (error) {
      // Try with 'master' branch if 'main' fails
      if (error instanceof Error && 'status' in error && (error as any).status === 422) {
        const { data: pr } = await this.octokit.rest.pulls.create({
          owner: issueData.owner,
          repo: issueData.repo,
          title: prTitle,
          body: prBody,
          head: branchName,
          base: 'master',
        });

        console.log(`🔗 Created PR #${pr.number}: ${pr.html_url}`);
        await this.commentOnIssue(issueData, `🤖 I've created a pull request to address this issue: ${pr.html_url}`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Add a comment to the issue
   */
  private async commentOnIssue(issueData: IssueData, comment: string): Promise<void> {
    try {
      await this.octokit.rest.issues.createComment({
        owner: issueData.owner,
        repo: issueData.repo,
        issue_number: issueData.issueNumber,
        body: comment,
      });
    } catch (error) {
      console.error('Failed to comment on issue:', error);
    }
  }

  /**
   * Generate Node.js code changes
   */
  private async generateNodeJSChanges(issueData: IssueData, repoPath: string): Promise<void> {
    console.log('🚀 Generating Node.js code changes...');
    
    const title = issueData.title.toLowerCase();
    const body = issueData.body?.toLowerCase() || '';
    
    // Add routes if mentioned
    if ((title.includes('route') || title.includes('endpoint') || body.includes('api')) &&
        (title.includes('add') || title.includes('create') || title.includes('new'))) {
      await this.generateNewNodeJSRoute(issueData, repoPath);
    }
    
    // Add middleware if mentioned
    if ((title.includes('middleware') || body.includes('middleware')) &&
        (title.includes('add') || title.includes('create') || title.includes('new'))) {
      await this.generateNewNodeJSMiddleware(issueData, repoPath);
    }
    
    // Add model if mentioned
    if ((title.includes('model') || title.includes('schema') || body.includes('database')) &&
        (title.includes('add') || title.includes('create') || title.includes('new'))) {
      await this.generateNewNodeJSModel(issueData, repoPath);
    }
  }

  /**
   * Generate a new Node.js route
   */
  private async generateNewNodeJSRoute(issueData: IssueData, repoPath: string): Promise<void> {
    const routeName = this.extractRouteNameFromIssue(issueData.title);
    const routesDir = path.join(repoPath, 'routes');
    
    // Create routes directory if it doesn't exist
    await fs.mkdir(routesDir, { recursive: true });
    
    const routePath = path.join(routesDir, `${routeName}.js`);
    const routeContent = this.generateNodeJSRouteCode(routeName);
    
    await fs.writeFile(routePath, routeContent);
    console.log(`📄 Created new route: ${routeName}.js`);
  }

  /**
   * Generate a new Node.js middleware
   */
  private async generateNewNodeJSMiddleware(issueData: IssueData, repoPath: string): Promise<void> {
    const middlewareName = this.extractMiddlewareNameFromIssue(issueData.title);
    const middlewareDir = path.join(repoPath, 'middleware');
    
    // Create middleware directory if it doesn't exist
    await fs.mkdir(middlewareDir, { recursive: true });
    
    const middlewarePath = path.join(middlewareDir, `${middlewareName}.js`);
    const middlewareContent = this.generateNodeJSMiddlewareCode(middlewareName);
    
    await fs.writeFile(middlewarePath, middlewareContent);
    console.log(`📄 Created new middleware: ${middlewareName}.js`);
  }

  /**
   * Generate a new Node.js model
   */
  private async generateNewNodeJSModel(issueData: IssueData, repoPath: string): Promise<void> {
    const modelName = this.extractModelNameFromIssue(issueData.title);
    const modelsDir = path.join(repoPath, 'models');
    
    // Create models directory if it doesn't exist
    await fs.mkdir(modelsDir, { recursive: true });
    
    const modelPath = path.join(modelsDir, `${modelName}.js`);
    const modelContent = this.generateNodeJSModelCode(modelName);
    
    await fs.writeFile(modelPath, modelContent);
    console.log(`📄 Created new model: ${modelName}.js`);
  }

  /**
   * Extract route name from issue
   */
  private extractRouteNameFromIssue(title: string): string {
    const words = title.toLowerCase().split(/\s+/);
    const routeWords = words.filter(word => 
      !['add', 'create', 'new', 'route', 'endpoint', 'api', 'the', 'a', 'an'].includes(word)
    );
    return routeWords.length > 0 ? routeWords[0] : 'newRoute';
  }

  /**
   * Extract middleware name from issue
   */
  private extractMiddlewareNameFromIssue(title: string): string {
    const words = title.toLowerCase().split(/\s+/);
    const middlewareWords = words.filter(word => 
      !['add', 'create', 'new', 'middleware', 'the', 'a', 'an'].includes(word)
    );
    return middlewareWords.length > 0 ? middlewareWords[0] : 'newMiddleware';
  }

  /**
   * Extract model name from issue
   */
  private extractModelNameFromIssue(title: string): string {
    const words = title.toLowerCase().split(/\s+/);
    const modelWords = words.filter(word => 
      !['add', 'create', 'new', 'model', 'schema', 'the', 'a', 'an'].includes(word)
    );
    return modelWords.length > 0 ? modelWords[0] : 'newModel';
  }

  /**
   * Generate Node.js route code
   */
  private generateNodeJSRouteCode(routeName: string): string {
    return `const express = require('express');
const router = express.Router();

// GET /${routeName}
router.get('/', (req, res) => {
  try {
    // TODO: Implement ${routeName} GET logic
    res.json({ message: '${routeName} endpoint working' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /${routeName}
router.post('/', (req, res) => {
  try {
    // TODO: Implement ${routeName} POST logic
    const data = req.body;
    res.status(201).json({ message: '${routeName} created', data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
`;
  }

  /**
   * Generate Node.js middleware code
   */
  private generateNodeJSMiddlewareCode(middlewareName: string): string {
    return `// ${middlewareName} middleware
const ${middlewareName} = (req, res, next) => {
  try {
    // TODO: Implement ${middlewareName} logic
    console.log('${middlewareName} middleware executed');
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = ${middlewareName};
`;
  }

  /**
   * Generate Node.js model code
   */
  private generateNodeJSModelCode(modelName: string): string {
    const capitalizedName = modelName.charAt(0).toUpperCase() + modelName.slice(1);
    return `const mongoose = require('mongoose');

const ${modelName}Schema = new mongoose.Schema({
  // TODO: Define ${modelName} schema fields
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
${modelName}Schema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const ${capitalizedName} = mongoose.model('${capitalizedName}', ${modelName}Schema);

module.exports = ${capitalizedName};
`;
  }

  /**
   * Generate Java entity code with project context
   */
  private generateJavaEntityCodeWithContext(entityName: string, packagePath: string, projectContext: any): string {
    const packageName = packagePath.replace(/\//g, '.');
    const persistenceImport = projectContext.projectConventions.usesJakarta ? 'jakarta.persistence' : 'javax.persistence';
    
    return `package ${packageName}.model;

import ${persistenceImport}.*;

/**
 * ${entityName} entity - Auto-generated by GitHub Agent
 * Following project conventions detected from existing code
 */
@Entity
@Table(name = "${entityName.toLowerCase()}")
public class ${entityName} {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private ${projectContext.projectConventions.entityIdType} id;
    
    @Column(nullable = false)
    private String name;
    
    private String description;
    
    // Constructors
    public ${entityName}() {}
    
    public ${entityName}(String name, String description) {
        this.name = name;
        this.description = description;
    }
    
    // Getters and Setters
    public ${projectContext.projectConventions.entityIdType} getId() {
        return id;
    }
    
    public void setId(${projectContext.projectConventions.entityIdType} id) {
        this.id = id;
    }
    
    public String getName() {
        return name;
    }
    
    public void setName(String name) {
        this.name = name;
    }
    
    public String getDescription() {
        return description;
    }
    
    public void setDescription(String description) {
        this.description = description;
    }
    
    @Override
    public String toString() {
        return "${entityName}{" +
                "id=" + id +
                ", name='" + name + "'" +
                ", description='" + description + "'" +
                '}';
    }
}
`;
  }

  /**
   * Generate Java controller code with project context
   */
  private generateJavaControllerCodeWithContext(controllerName: string, packagePath: string, projectContext: any): string {
    const packageName = packagePath.replace(/\//g, '.');
    const entityName = controllerName;
    
    return `package ${packageName}.controller;

import ${packageName}.model.${entityName};
import ${packageName}.service.${controllerName}Service;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * ${controllerName} REST Controller - Auto-generated by GitHub Agent
 * Following Spring Boot patterns found in existing controllers
 */
@RestController
@RequestMapping("/api/${controllerName.toLowerCase()}")
@CrossOrigin(origins = "*")
public class ${controllerName}Controller {
    
    @Autowired
    private ${controllerName}Service ${controllerName.toLowerCase()}Service;
    
    @GetMapping
    public ResponseEntity<List<${entityName}>> getAll() {
        List<${entityName}> items = ${controllerName.toLowerCase()}Service.findAll();
        return ResponseEntity.ok(items);
    }
    
    @GetMapping("/{id}")
    public ResponseEntity<${entityName}> getById(@PathVariable ${projectContext.projectConventions.entityIdType} id) {
        ${entityName} item = ${controllerName.toLowerCase()}Service.findById(id);
        if (item != null) {
            return ResponseEntity.ok(item);
        }
        return ResponseEntity.notFound().build();
    }
    
    @PostMapping
    public ResponseEntity<${entityName}> create(@RequestBody ${entityName} ${entityName.toLowerCase()}) {
        ${entityName} saved = ${controllerName.toLowerCase()}Service.save(${entityName.toLowerCase()});
        return ResponseEntity.ok(saved);
    }
    
    @PutMapping("/{id}")
    public ResponseEntity<${entityName}> update(@PathVariable ${projectContext.projectConventions.entityIdType} id, @RequestBody ${entityName} ${entityName.toLowerCase()}) {
        ${entityName} updated = ${controllerName.toLowerCase()}Service.update(id, ${entityName.toLowerCase()});
        if (updated != null) {
            return ResponseEntity.ok(updated);
        }
        return ResponseEntity.notFound().build();
    }
    
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable ${projectContext.projectConventions.entityIdType} id) {
        ${controllerName.toLowerCase()}Service.delete(id);
        return ResponseEntity.ok().build();
    }
}
`;
  }

  /**
   * Generate Java service code with project context
   */
  private generateJavaServiceCodeWithContext(serviceName: string, entityName: string, packagePath: string, projectContext: any): string {
    const packageName = packagePath.replace(/\//g, '.');
    
    return `package ${packageName}.service;

import ${packageName}.model.${entityName};
import ${packageName}.repository.${entityName}Repository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

/**
 * ${serviceName} Service - Auto-generated by GitHub Agent
 * Following service patterns found in existing code
 */
@Service
public class ${serviceName}Service {
    
    @Autowired
    private ${entityName}Repository ${entityName.toLowerCase()}Repository;
    
    public List<${entityName}> findAll() {
        return ${entityName.toLowerCase()}Repository.findAll();
    }
    
    public ${entityName} findById(${projectContext.projectConventions.entityIdType} id) {
        Optional<${entityName}> optional = ${entityName.toLowerCase()}Repository.findById(id);
        return optional.orElse(null);
    }
    
    public ${entityName} save(${entityName} ${entityName.toLowerCase()}) {
        return ${entityName.toLowerCase()}Repository.save(${entityName.toLowerCase()});
    }
    
    public ${entityName} update(${projectContext.projectConventions.entityIdType} id, ${entityName} ${entityName.toLowerCase()}) {
        if (${entityName.toLowerCase()}Repository.existsById(id)) {
            ${entityName.toLowerCase()}.setId(id);
            return ${entityName.toLowerCase()}Repository.save(${entityName.toLowerCase()});
        }
        return null;
    }
    
    public void delete(${projectContext.projectConventions.entityIdType} id) {
        ${entityName.toLowerCase()}Repository.deleteById(id);
    }
}
`;
  }

  /**
   * Generate Java repository code with project context
   */
  private generateJavaRepositoryCodeWithContext(entityName: string, packagePath: string, projectContext: any): string {
    const packageName = packagePath.replace(/\//g, '.');
    
    return `package ${packageName}.repository;

import ${packageName}.model.${entityName};
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * ${entityName} Repository - Auto-generated by GitHub Agent
 * Following repository patterns found in existing code
 */
@Repository
public interface ${entityName}Repository extends JpaRepository<${entityName}, ${projectContext.projectConventions.entityIdType}> {
    
    // JpaRepository provides basic CRUD operations
    // Add custom query methods here if needed
    
    // Example: Find by name
    // ${entityName} findByName(String name);
    
    // Example: Find by description containing
    // List<${entityName}> findByDescriptionContaining(String keyword);
}
`;
  }

  /**
   * Clean up the workspace folder for a specific repository
   */
  private async cleanupWorkspace(owner: string, repo: string): Promise<void> {
    const repoPath = path.join(this.workspaceDir, `${owner}-${repo}`);
    
    try {
      console.log(`🧹 Cleaning up workspace: ${repoPath}`);
      await fs.rm(repoPath, { recursive: true, force: true });
      console.log(`✅ Successfully cleaned up workspace folder`);
    } catch (error) {
      console.error(`⚠️ Failed to cleanup workspace ${repoPath}:`, error);
      // Don't throw error - cleanup is non-critical
    }
  }
}
