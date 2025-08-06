import fs from 'fs/promises';
import path from 'path';

/**
 * Free AI Service using Ollama (Local AI)
 * 
 * Installation:
 * 1. Download Ollama from https://ollama.ai
 * 2. Install a code model: ollama pull codellama:7b
 * 3. Start Ollama service
 * 
 * Alternative free options:
 * - Hugging Face API (free tier)
 * - Google Gemini (generous free tier)
 * - OpenAI free tier
 */

interface OllamaResponse {
  response: string;
  done: boolean;
}

interface ModelResponse {
  text: string;
  success: boolean;
}

export class FreeAIService {
  private isEnabled = false;
  private ollamaUrl: string;
  private model: string;
  private serviceType: 'ollama' | 'huggingface' | 'gemini' | 'disabled';

  constructor() {
    this.ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    this.model = process.env.OLLAMA_MODEL || 'codellama:7b';
    this.serviceType = 'disabled';
    
    this.initializeService();
  }

  private async initializeService(): Promise<void> {
    // Try Ollama first (completely free, local)
    if (await this.checkOllama()) {
      this.serviceType = 'ollama';
      this.isEnabled = true;
      console.log('✅ Ollama AI service initialized successfully');
      console.log(`🤖 Using model: ${this.model}`);
      return;
    }

    // Try Hugging Face free tier
    if (process.env.HUGGINGFACE_API_KEY) {
      this.serviceType = 'huggingface';
      this.isEnabled = true;
      console.log('✅ Hugging Face AI service initialized');
      return;
    }

    // Try Google Gemini free tier
    if (process.env.GOOGLE_API_KEY) {
      this.serviceType = 'gemini';
      this.isEnabled = true;
      console.log('✅ Google Gemini AI service initialized');
      return;
    }

    console.log('⚠️ No AI service available - using template fallback');
  }

  private async checkOllama(): Promise<boolean> {
    try {
      const response = await fetch(`${this.ollamaUrl}/api/version`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Generate AI response using available service
   */
  private async generateWithAI(prompt: string): Promise<ModelResponse> {
    if (!this.isEnabled) {
      return { text: '', success: false };
    }

    try {
      switch (this.serviceType) {
        case 'ollama':
          return await this.generateWithOllama(prompt);
        case 'huggingface':
          return await this.generateWithHuggingFace(prompt);
        case 'gemini':
          return await this.generateWithGemini(prompt);
        default:
          return { text: '', success: false };
      }
    } catch (error) {
      console.error(`❌ AI generation failed:`, error);
      return { text: '', success: false };
    }
  }

  /**
   * Ollama local AI generation (100% free) with timeout
   */
  private async generateWithOllama(prompt: string): Promise<ModelResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 minute timeout (600 seconds)
    
    try {
      const response = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt: prompt,
          stream: false
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Ollama request failed: ${response.statusText}`);
      }

      const data = await response.json() as OllamaResponse;
      return { text: data.response, success: true };
      
    } catch (error) {
      clearTimeout(timeoutId);
      if ((error as Error).name === 'AbortError') {
        console.log('⏱️ Ollama request timed out after 10 minutes, falling back to templates');
        throw new Error('Ollama timeout');
      }
      throw error;
    }
  }

  /**
   * Hugging Face API generation (free tier available)
   */
  private async generateWithHuggingFace(prompt: string): Promise<ModelResponse> {
    const model = process.env.HF_MODEL || 'microsoft/DialoGPT-medium';
    const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ inputs: prompt })
    });

    if (!response.ok) {
      throw new Error(`Hugging Face request failed: ${response.statusText}`);
    }

    const data = await response.json() as any;
    const text = Array.isArray(data) ? data[0]?.generated_text || '' : data.generated_text || '';
    return { text, success: true };
  }

  /**
   * Google Gemini generation (generous free tier)
   */
  private async generateWithGemini(prompt: string): Promise<ModelResponse> {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GOOGLE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini request failed: ${response.statusText}`);
    }

    const data = await response.json() as any;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return { text, success: true };
  }

  /**
   * Extract entity name from issue using AI
   */
  async extractEntityNameWithAI(title: string, body: string): Promise<string> {
    const prompt = `Extract the main entity name from this GitHub issue:

Title: ${title}
Body: ${body}

Return only the entity name (like "Customer", "Product", "Order") without explanation.`;

    const result = await this.generateWithAI(prompt);
    
    if (result.success && result.text.trim()) {
      // Clean up the response to get just the entity name
      const entityName = result.text.trim().split('\n')[0].replace(/[^a-zA-Z]/g, '');
      return entityName.charAt(0).toUpperCase() + entityName.slice(1);
    }

    // Fallback to template-based extraction
    return this.extractEntityNameTemplate(title);
  }

  /**
   * Analyze issue with AI
   */
  async analyzeIssueWithAI(issueData: any, codebaseContext: any): Promise<string> {
    // Read project documentation for better context
    const projectDocs = await this.readProjectDocumentation(codebaseContext.repoPath);
    
    const prompt = `You are a senior Java Spring Boot developer. Analyze this GitHub issue and create a detailed implementation plan.

${projectDocs}

## GitHub Issue Details:
**Title:** ${issueData.title}
**Issue Number:** #${issueData.issueNumber}
**Labels:** ${issueData.labels ? issueData.labels.join(', ') : 'None'}

**Description:**
${issueData.body || 'No description provided'}

## Existing Codebase Context:
- Project Type: ${codebaseContext.projectType || 'Spring Boot'}
- Entities Found: ${codebaseContext.entities ? codebaseContext.entities.length : 0}
- Controllers Found: ${codebaseContext.controllers ? codebaseContext.controllers.length : 0}
- Services Found: ${codebaseContext.services ? codebaseContext.services.length : 0}
- Package Structure: ${codebaseContext.packageName || 'com.example.demo'}

## Existing Entities:
${codebaseContext.entities ? codebaseContext.entities.map((e: any) => `- ${e.name}: ${e.fields ? e.fields.join(', ') : 'Unknown fields'}`).join('\n') : 'No entities found'}

## Task:
Based on the project documentation and development guidelines above, analyze the issue requirements and create a step-by-step implementation plan. Be specific about:
1. What entity/feature needs to be created
2. Required fields and their types
3. Business logic requirements
4. API endpoints needed
5. Validation rules
6. Relationships with existing entities

Provide a clear, actionable implementation plan.`;

    try {
      const result = await this.generateWithAI(prompt);
      
      if (result.success) {
        console.log('✅ AI analysis completed successfully');
        return result.text;
      } else {
        throw new Error('AI generation returned unsuccessful result');
      }
    } catch (error) {
      console.log(`⚠️ AI analysis failed (${(error as Error).message}), using template analysis`);
      
      // Enhanced fallback analysis with issue content
      return `Implementation plan for: ${issueData.title}

**Issue Analysis:**
${issueData.body ? `Requirements: ${issueData.body.substring(0, 200)}...` : 'No specific requirements provided'}

**Implementation Steps:**
1. Analyze requirements from issue description: "${issueData.title}"
2. Create entity class with appropriate fields based on requirements
3. Implement repository interface extending JpaRepository
4. Create service layer with business logic
5. Add REST controller with CRUD operations
6. Write comprehensive tests
7. Update documentation

**Technical Details:**
- Follow existing project patterns (${codebaseContext.projectType || 'Spring Boot'})
- Use package: ${codebaseContext.packageName || 'com.example.demo'}
- Follow JPA conventions from existing entities
- Implement proper validation and error handling`;
    }
  }

  /**
   * Generate Java entity with AI
   */
  async generateJavaEntityWithAI(entityName: string, requirements: string, codebaseContext: any): Promise<string> {
    // Read project documentation for better context
    const projectDocs = await this.readProjectDocumentation(codebaseContext.repoPath);
    
    const prompt = `You are an expert Java Spring Boot developer. Generate a complete entity class based on these requirements.

${projectDocs}

## Entity Requirements:
**Entity Name:** ${entityName}
**Full Requirements:** ${requirements}

## Project Context:
- Package: ${codebaseContext.packageName || 'com.example.demo'}.model
- Framework: Spring Boot with JPA/Hibernate
- Database: ${codebaseContext.database || 'H2/MySQL'}

## Existing Project Conventions:
${codebaseContext.entities && codebaseContext.entities.length > 0 
  ? `- Follow patterns from existing entities: ${codebaseContext.entities.map((e: any) => e.name).join(', ')}`
  : '- Create following standard JPA patterns'}
- Use jakarta.persistence annotations (not javax)
- Include @Entity, @Table, @Id, @GeneratedValue annotations
- Use proper field types (Long for ID, LocalDateTime for dates, BigDecimal for money)
- Include default and parameterized constructors
- Add getters and setters
- Override equals() and hashCode() based on ID
- Add validation annotations where appropriate

## Instructions:
1. Follow the project guidelines and development patterns from the documentation above
2. Analyze the requirements carefully to determine appropriate fields
3. Use proper Java naming conventions (camelCase for fields, PascalCase for class)
4. Choose appropriate data types based on field purpose
5. Add JPA annotations for database mapping
6. Include validation annotations (@NotNull, @Size, etc.)
7. Generate complete, production-ready code that follows the project's coding standards

Generate only the Java code without explanations or markdown formatting.`;

    const result = await this.generateWithAI(prompt);
    
    if (result.success && result.text.includes('class')) {
      return result.text;
    }

    // Fallback to template
    return this.generateEntityTemplate(entityName, codebaseContext);
  }

  /**
   * Generate Java repository with AI
   */
  async generateJavaRepositoryWithAI(entityName: string, requirements: string, codebaseContext: any): Promise<string> {
    // Read project documentation for better context
    const projectDocs = await this.readProjectDocumentation(codebaseContext.repoPath);
    
    const prompt = `Generate a Spring Boot JPA repository interface for this entity following project guidelines.

${projectDocs}

## Requirements:
**Entity:** ${entityName}
**Requirements:** ${requirements}

## Project Context:
- Package: ${codebaseContext.packageName || 'com.example.demo'}.repository
- Entity Package: ${codebaseContext.packageName || 'com.example.demo'}.model
- ID Type: ${codebaseContext.entityIdType || 'Long'}

## Instructions:
1. Follow the project guidelines and development patterns from the documentation above
2. Create repository interface extending JpaRepository<${entityName}, ${codebaseContext.entityIdType || 'Long'}>
3. Add @Repository annotation
4. Include custom query methods based on the requirements
5. Use proper method naming conventions (findBy, existsBy, deleteBy)
6. Add appropriate @Query annotations for complex queries if needed
7. Follow the project's coding standards and patterns

Generate only the Java interface code without explanations.`;

    const result = await this.generateWithAI(prompt);
    
    if (result.success && result.text.includes('interface')) {
      return result.text;
    }

    // Fallback to template
    return this.generateRepositoryTemplate(entityName, codebaseContext);
  }

  /**
   * Generate Java service with AI
   */
  async generateJavaServiceWithAI(entityName: string, requirements: string, codebaseContext: any): Promise<string> {
    const prompt = `Generate a Java Spring Boot service class:

Entity: ${entityName}
Requirements: ${requirements}

Include CRUD operations and business logic methods.
Use @Service annotation and dependency injection.
Generate only the Java code.`;

    const result = await this.generateWithAI(prompt);
    
    if (result.success && result.text.includes('class')) {
      return result.text;
    }

    // Fallback to template
    return this.generateServiceTemplate(entityName, codebaseContext);
  }

  /**
   * Generate Java controller with AI
   */
  async generateJavaControllerWithAI(entityName: string, requirements: string, codebaseContext: any): Promise<string> {
    const prompt = `Generate a Java Spring Boot REST controller:

Entity: ${entityName}
Requirements: ${requirements}

Include CRUD endpoints with proper HTTP methods.
Use @RestController and @RequestMapping.
Generate only the Java code.`;

    const result = await this.generateWithAI(prompt);
    
    if (result.success && result.text.includes('class')) {
      return result.text;
    }

    // Fallback to template
    return this.generateControllerTemplate(entityName, codebaseContext);
  }

  // Template fallback methods
  private extractEntityNameTemplate(title: string): string {
    const patterns = [
      /create\s+(?:a\s+)?(\w+)\s+entity/i,
      /add\s+(?:a\s+)?(\w+)\s+entity/i,
      /implement\s+(?:a\s+)?(\w+)/i,
      /(\w+)\s+entity/i,
    ];
    
    for (const pattern of patterns) {
      const match = title.match(pattern);
      if (match && match[1]) {
        return match[1].charAt(0).toUpperCase() + match[1].slice(1);
      }
    }
    return 'DefaultEntity';
  }

  private generateEntityTemplate(entityName: string, context: any): string {
    return `package ${context.packageName || 'com.example.demo'}.model;

import jakarta.persistence.*;

@Entity
@Table(name = "${entityName.toLowerCase()}s")
public class ${entityName} {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    private String name;
    
    // Constructors, getters, setters
    public ${entityName}() {}
    
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
}`;
  }

  private generateRepositoryTemplate(entityName: string, context: any): string {
    return `package ${context.packageName || 'com.example.demo'}.repository;

import ${context.packageName || 'com.example.demo'}.model.${entityName};
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ${entityName}Repository extends JpaRepository<${entityName}, Long> {
}`;
  }

  private generateServiceTemplate(entityName: string, context: any): string {
    return `package ${context.packageName || 'com.example.demo'}.service;

import ${context.packageName || 'com.example.demo'}.model.${entityName};
import ${context.packageName || 'com.example.demo'}.repository.${entityName}Repository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class ${entityName}Service {
    @Autowired
    private ${entityName}Repository repository;
    
    public List<${entityName}> findAll() {
        return repository.findAll();
    }
    
    public ${entityName} save(${entityName} entity) {
        return repository.save(entity);
    }
}`;
  }

  private generateControllerTemplate(entityName: string, context: any): string {
    return `package ${context.packageName || 'com.example.demo'}.controller;

import ${context.packageName || 'com.example.demo'}.model.${entityName};
import ${context.packageName || 'com.example.demo'}.service.${entityName}Service;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/${entityName.toLowerCase()}s")
public class ${entityName}Controller {
    @Autowired
    private ${entityName}Service service;
    
    @GetMapping
    public List<${entityName}> getAll() {
        return service.findAll();
    }
    
    @PostMapping
    public ${entityName} create(@RequestBody ${entityName} entity) {
        return service.save(entity);
    }
}`;
  }

  /**
   * Read project documentation for better AI context
   */
  private async readProjectDocumentation(repoPath?: string): Promise<string> {
    let documentation = '';
    const basePath = repoPath || '.';
    
    try {
      // Read README.md
      try {
        const readmePath = path.join(basePath, 'README.md');
        const readme = await fs.readFile(readmePath, 'utf-8');
        documentation += `## Project README:\n${readme.substring(0, 2000)}\n\n`;
      } catch {
        // README not found or accessible
      }

      // Read Copilot instructions
      try {
        const copilotPath = path.join(basePath, '.github', 'copilot-instructions.md');
        const copilotInstructions = await fs.readFile(copilotPath, 'utf-8');
        documentation += `## Development Guidelines:\n${copilotInstructions}\n\n`;
      } catch {
        // Copilot instructions not found
      }

      // Read package.json for project info
      try {
        const packagePath = path.join(basePath, 'package.json');
        const packageJson = await fs.readFile(packagePath, 'utf-8');
        const pkg = JSON.parse(packageJson);
        documentation += `## Project Configuration:\n`;
        documentation += `- Name: ${pkg.name}\n`;
        documentation += `- Description: ${pkg.description || 'N/A'}\n`;
        documentation += `- Dependencies: ${Object.keys(pkg.dependencies || {}).slice(0, 10).join(', ')}\n\n`;
      } catch {
        // package.json not found
      }

    } catch (error) {
      console.log('⚠️ Could not read project documentation:', (error as Error).message);
    }

    return documentation || '## Project Documentation:\nNo documentation found.\n\n';
  }

  public isAIEnabled(): boolean {
    return this.isEnabled;
  }

  public getServiceType(): string {
    return this.serviceType;
  }
}
