import fs from 'fs/promises';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

/**
 * AI Service with Claude Sonnet 4 as primary provider
 * 
 * Priority order:
 * 1. Claude Sonnet 4 (Anthropic API) - Most capable
 * 2. Google Gemini (generous free tier)
 * 3. Ollama (Local AI)
 * 4. Hugging Face API (free tier)
 * 
 * Environment Variables:
 * - ANTHROPIC_API_KEY: Claude API key
 * - GOOGLE_API_KEY: Google Gemini API key
 * - OLLAMA_URL: Local Ollama service URL
 * - HUGGINGFACE_API_KEY: HuggingFace API key
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
  private anthropic: Anthropic | null = null;
  private serviceType: 'claude' | 'gemini' | 'ollama' | 'huggingface' | 'disabled';
  private timeoutHistory: Map<string, number> = new Map(); // Track timeout counts per method
  private readonly DEFAULT_TIMEOUT = parseInt(process.env.AI_TIMEOUT_MS || '600000'); // 10 minutes default
  private readonly MAX_TIMEOUTS_BEFORE_FALLBACK = 1; // After 1 timeout, use templates (no retry)

  constructor() {
    this.ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    this.model = process.env.OLLAMA_MODEL || 'codellama:7b';
    this.serviceType = 'disabled';
    this.anthropic = null;
    
    console.log(`⏱️ AI Timeout Configuration: ${this.DEFAULT_TIMEOUT/1000/60} minutes, max timeouts before fallback: ${this.MAX_TIMEOUTS_BEFORE_FALLBACK}`);
    
    this.initializeService();
  }

  private async initializeService(): Promise<void> {
    // Try Claude Sonnet 4 first (most capable)
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        this.anthropic = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY,
        });
        this.serviceType = 'claude';
        this.isEnabled = true;
        console.log('✅ Claude Sonnet 4 AI service initialized successfully');
        console.log('🤖 Using model: claude-3-5-sonnet-20241022');
        return;
      } catch (error) {
        console.error('❌ Failed to initialize Claude:', error);
      }
    }

    // Try Google Gemini (generous free tier)
    if (process.env.GOOGLE_API_KEY) {
      this.serviceType = 'gemini';
      this.isEnabled = true;
      console.log('✅ Google Gemini AI service initialized');
      return;
    }

    // Try Ollama (completely free, local)
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
   * Universal timeout wrapper for all AI calls
   */
  private async withTimeout<T>(
    operation: () => Promise<T>, 
    methodName: string, 
    timeoutMs: number = this.DEFAULT_TIMEOUT
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      console.log(`⏱️ ${methodName} timed out after ${timeoutMs/1000/60} minutes`);
    }, timeoutMs);

    try {
      // Race between the operation and timeout
      const result = await Promise.race([
        operation(),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(new Error(`${methodName} timeout after ${timeoutMs/1000/60} minutes`));
          });
        })
      ]);

      clearTimeout(timeoutId);
      
      // Reset timeout count on success
      this.timeoutHistory.set(methodName, 0);
      return result;
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      if ((error as Error).message.includes('timeout')) {
        // Increment timeout count
        const currentTimeouts = this.timeoutHistory.get(methodName) || 0;
        this.timeoutHistory.set(methodName, currentTimeouts + 1);
        
        console.log(`⚠️ ${methodName} timeout - immediately switching to template fallback to save costs`);
        
        if (currentTimeouts + 1 >= this.MAX_TIMEOUTS_BEFORE_FALLBACK) {
          console.log(`🔄 ${methodName} will use templates for all future calls`);
        }
      }
      
      throw error;
    }
  }

  /**
   * Check if method should use template fallback due to repeated timeouts
   */
  private shouldUseTemplateFallback(methodName: string): boolean {
    const timeoutCount = this.timeoutHistory.get(methodName) || 0;
    return timeoutCount >= this.MAX_TIMEOUTS_BEFORE_FALLBACK;
  }

  /**
   * Reset timeout history for all methods (useful for debugging)
   */
  public resetTimeoutHistory(): void {
    this.timeoutHistory.clear();
    console.log('🔄 Reset timeout history for all AI methods');
  }

  /**
   * Get current timeout statistics
   */
  public getTimeoutStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    this.timeoutHistory.forEach((count, method) => {
      stats[method] = count;
    });
    return stats;
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
        case 'claude':
          return await this.generateWithClaude(prompt);
        case 'gemini':
          return await this.generateWithGemini(prompt);
        case 'ollama':
          return await this.generateWithOllama(prompt);
        case 'huggingface':
          return await this.generateWithHuggingFace(prompt);
        default:
          return { text: '', success: false };
      }
    } catch (error) {
      console.error(`❌ AI generation failed:`, error);
      return { text: '', success: false };
    }
  }

  /**
   * Claude Sonnet 4 generation (Anthropic API) with timeout
   */
  private async generateWithClaude(prompt: string): Promise<ModelResponse> {
    if (!this.anthropic) {
      throw new Error('Claude service not initialized');
    }

    return await this.withTimeout(async () => {
      const response = await this.anthropic!.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        temperature: 0.1,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const text = response.content
        .filter((content: any) => content.type === 'text')
        .map((content: any) => content.text)
        .join('\n');

      return { text, success: true };
    }, 'Claude', this.DEFAULT_TIMEOUT);
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
   * Hugging Face API generation (free tier available) with timeout
   */
  private async generateWithHuggingFace(prompt: string): Promise<ModelResponse> {
    return await this.withTimeout(async () => {
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
    }, 'HuggingFace', this.DEFAULT_TIMEOUT);
  }

  /**
   * Google Gemini generation (generous free tier) with timeout
   */
  private async generateWithGemini(prompt: string): Promise<ModelResponse> {
    return await this.withTimeout(async () => {
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
    }, 'Gemini', this.DEFAULT_TIMEOUT);
  }

  /**
   * Generate complete Spring Boot components in a single AI call (Cost Optimized)
   */
  async generateCompleteSpringBootComponentsWithAI(
    entityName: string, 
    requirements: string, 
    codebaseContext: any
  ): Promise<{
    entity: string;
    repository: string;
    service: string;
    controller: string;
  }> {
    // Read project documentation for better context
    const projectDocs = await this.readProjectDocumentation(codebaseContext.repoPath);
    
    const prompt = `You are an expert Java Spring Boot developer working on an existing project. Generate ALL four components (Entity, Repository, Service, Controller) for a complete CRUD implementation in a SINGLE response.

${projectDocs}

## IMPORTANT: 
- STRICTLY FOLLOW the development guidelines and patterns specified above
- Use the EXACT package structure and naming conventions from the project documentation
- Generate ALL four components in the exact format specified below
- Follow the architectural patterns and coding standards defined in the guidelines

## PRIMARY REQUIREMENTS (ANALYZE CAREFULLY):
${requirements}

## Component Generation Task:
**Entity Name:** ${entityName}

## CRITICAL FIELD EXTRACTION:
- Look for phrases like "fields:", "with fields:", "properties:", "attributes:"
- Extract EXACT field names from the requirements above
- Common patterns: "fields: name, email, phone" or "with fields: make, model, year"
- Do NOT use generic fields - use ONLY the specified fields from requirements

## CRITICAL INSTRUCTIONS:
- FOCUS PRIMARILY on the detailed requirements above
- Extract ALL fields, data types, and relationships from the requirements
- Use EXACT field names mentioned in the requirements (e.g., make, model, year, title)
- Determine appropriate Java data types (String for text, Integer for numbers, LocalDate for dates)
- Determine validation rules and business logic from the requirements
- Identify API endpoints and methods needed based on the requirements

## Project Context:
- Base Package: ${codebaseContext.packageName || 'com.example.demo'}
- Framework: Spring Boot with JPA/Hibernate
- Database: ${codebaseContext.database || 'H2/MySQL'}

## Existing Components in Project:
${codebaseContext.entities && codebaseContext.entities.length > 0 
  ? codebaseContext.entities.map((e: any) => `- ${e.name}: [${e.fields ? e.fields.join(', ') : 'Unknown fields'}]`).join('\n')
  : '- No existing entities found'}

## CRITICAL OUTPUT FORMAT:
Generate exactly in this format with clear separators:

=== ENTITY ===
[Complete Entity class code here]

=== REPOSITORY ===
[Complete Repository interface code here]

=== SERVICE ===
[Complete Service class code here]

=== CONTROLLER ===
[Complete Controller class code here]

## CODE GENERATION REQUIREMENTS:
1. **CRITICAL**: Follow ALL patterns and conventions from the development guidelines above
2. **ENTITY REQUIREMENTS**:
   - Analyze requirements to extract appropriate fields and determine smart data types
   - Use String for text, Integer for numbers/ages, BigDecimal for prices/amounts, LocalDateTime for dates, Boolean for flags
   - Add comprehensive validation annotations (@NotBlank, @Size, @Email, @Min, @DecimalMin, @PastOrPresent)
   - Include audit fields (createdAt, updatedAt) with @PreUpdate lifecycle
   - Generate proper constructors (default + parameterized), equals/hashCode, toString
   - Add @Column annotations for explicit database mapping
3. **REPOSITORY REQUIREMENTS**:
   - Extend JpaRepository<${entityName}, Long> with @Repository annotation
   - Generate custom query methods based on entity fields (findBy, existsBy, containsIgnoreCase)
   - Add ordering methods (findAllByOrderByIdAsc/Desc)
   - Include @Query examples for complex operations
   - Add field-specific search methods based on extracted fields
4. **SERVICE REQUIREMENTS**:
   - Use constructor injection instead of @Autowired field injection
   - Add @Transactional class annotation and @Transactional(readOnly = true) for queries
   - Implement complete CRUD: findAll, findById (Optional<>), save, update, deleteById, existsById, count
   - Add comprehensive validation with IllegalArgumentException for null inputs
   - Use proper exception handling with RuntimeException for "not found" scenarios
   - Include meaningful error messages and business logic structure
5. **CONTROLLER REQUIREMENTS**:
   - Use constructor injection and @Validated class annotation
   - Implement full REST API: GET /, GET /{id}, POST /, PUT /{id}, DELETE /{id}
   - Add utility endpoints: GET /{id}/exists, GET /count
   - Use ResponseEntity with proper HTTP status codes (200, 201, 204, 400, 404, 500)
   - Add comprehensive exception handling with try-catch blocks
   - Include @Valid, @NotNull annotations for request validation
   - Use @CrossOrigin(origins = "*") for CORS support
   - Follow REST naming conventions (plural entity names in paths)
6. **GENERAL REQUIREMENTS**:
   - Use jakarta.persistence (not javax) annotations throughout
   - Follow the package structure and import patterns from existing codebase
   - Add comprehensive JavaDoc comments for all public methods
   - Use consistent coding style and professional variable naming
   - Ensure all components work together seamlessly with proper dependency injection

Generate ONLY the four code blocks without additional explanations or markdown formatting.`;

    // Check if we should skip AI due to repeated timeouts
    if (this.shouldUseTemplateFallback('generateCompleteSpringBootComponents')) {
      console.log(`⏭️ Skipping AI generation due to repeated timeouts, using templates directly`);
      const contextWithRequirements = { ...codebaseContext, originalRequirements: requirements };
      return {
        entity: this.generateEntityTemplate(entityName, contextWithRequirements),
        repository: this.generateRepositoryTemplate(entityName, contextWithRequirements),
        service: this.generateServiceTemplate(entityName, contextWithRequirements),
        controller: this.generateControllerTemplate(entityName, contextWithRequirements)
      };
    }

    const result = await this.generateWithAI(prompt);
    
    console.log(`🔍 AI Generation Result: success=${result.success}, hasEntitySection=${result.text.includes('=== ENTITY ===')}`);
    if (!result.success) {
      console.log(`⚠️ AI generation failed, falling back to templates with requirements: "${requirements.substring(0, 100)}..."`);
    }
    
    if (result.success && result.text.includes('=== ENTITY ===')) {
      // Parse the response to extract individual components
      const parts = result.text.split('===');
      
      // Add requirements to context for fallback templates
      const contextWithRequirements = { ...codebaseContext, originalRequirements: requirements };
      
      return {
        entity: this.extractCodeSection(parts, 'ENTITY') || this.generateEntityTemplate(entityName, contextWithRequirements),
        repository: this.extractCodeSection(parts, 'REPOSITORY') || this.generateRepositoryTemplate(entityName, contextWithRequirements),
        service: this.extractCodeSection(parts, 'SERVICE') || this.generateServiceTemplate(entityName, contextWithRequirements),
        controller: this.extractCodeSection(parts, 'CONTROLLER') || this.generateControllerTemplate(entityName, contextWithRequirements)
      };
    }

    // Fallback to templates if AI fails
    const contextWithRequirements = { ...codebaseContext, originalRequirements: requirements };
    return {
      entity: this.generateEntityTemplate(entityName, contextWithRequirements),
      repository: this.generateRepositoryTemplate(entityName, contextWithRequirements),
      service: this.generateServiceTemplate(entityName, contextWithRequirements),
      controller: this.generateControllerTemplate(entityName, contextWithRequirements)
    };
  }

  /**
   * Helper method to extract code sections from AI response
   */
  private extractCodeSection(parts: string[], sectionName: string): string | null {
    const section = parts.find(part => part.trim().startsWith(sectionName));
    if (section) {
      return section.replace(sectionName, '').trim();
    }
    return null;
  }

  /**
   * Extract entity name from issue using AI (prioritizes body content)
   */
  async extractEntityNameWithAI(primaryContent: string, fullContext: string): Promise<string> {
    // Check if we should skip AI due to repeated timeouts
    if (this.shouldUseTemplateFallback('extractEntityName')) {
      console.log(`⏭️ Skipping AI entity extraction due to repeated timeouts, using template fallback`);
      const templateResult = this.extractEntityNameTemplate(primaryContent);
      console.log(`📝 Template extracted entity name: "${templateResult}"`);
      return templateResult;
    }

    // Prioritize the primary content (usually the body) for entity extraction
    const prompt = `Extract the main entity name from this GitHub issue content:

Primary Content (Main Requirements):
${primaryContent}

${fullContext !== primaryContent ? `Full Context:\n${fullContext}` : ''}

Instructions:
- Focus primarily on the main requirements above
- Extract the main entity/model name that needs to be created
- Return only the entity name (like "Customer", "Product", "Order", "Employee") without explanation
- If multiple entities are mentioned, return the most important one`;

    const result = await this.generateWithAI(prompt);
    
    console.log(`🎯 Entity extraction: success=${result.success}, text="${result.text.substring(0, 100)}..."`);
    
    if (result.success && result.text.trim()) {
      // Clean up the response to get just the entity name
      const entityName = result.text.trim().split('\n')[0].replace(/[^a-zA-Z]/g, '');
      const finalEntityName = entityName.charAt(0).toUpperCase() + entityName.slice(1);
      console.log(`✅ AI extracted entity name: "${finalEntityName}"`);
      return finalEntityName;
    }

    // Fallback to template-based extraction using primary content
    console.log(`⚠️ AI entity extraction failed, using template fallback with: "${primaryContent.substring(0, 100)}..."`);
    const templateResult = this.extractEntityNameTemplate(primaryContent);
    console.log(`📝 Template extracted entity name: "${templateResult}"`);
    return templateResult;
  }

  /**
   * Analyze issue with AI
   */
  async analyzeIssueWithAI(issueData: any, codebaseContext: any): Promise<string> {
    // Check if we should skip AI due to repeated timeouts
    if (this.shouldUseTemplateFallback('analyzeIssue')) {
      console.log(`⏭️ Skipping AI analysis due to repeated timeouts, using template analysis`);
      return `Implementation plan for: ${issueData.title}

**Issue Analysis:**
${issueData.body ? `Requirements: ${issueData.body.substring(0, 500)}...` : 'No specific requirements provided'}

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

    // Read project documentation for better context
    const projectDocs = await this.readProjectDocumentation(codebaseContext.repoPath);
    
    const prompt = `You are a senior Java Spring Boot developer. Analyze this GitHub issue and create a detailed implementation plan.

${projectDocs}

## PRIMARY REQUIREMENTS (Focus Here):
${issueData.body || 'No detailed requirements provided'}

## GitHub Issue Details:
**Issue Number:** #${issueData.issueNumber}
**Title:** ${issueData.title}
**Labels:** ${issueData.labels ? issueData.labels.join(', ') : 'None'}

## CRITICAL: 
- FOCUS PRIMARILY on the detailed requirements above
- The title is secondary - the main requirements are in the body content
- Extract ALL technical details from the primary requirements section

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
    
    const prompt = `You are an expert Java Spring Boot developer working on an existing project. Generate a complete entity class that follows the project's specific guidelines and patterns.

${projectDocs}

## IMPORTANT: 
- STRICTLY FOLLOW the development guidelines and patterns specified above
- Use the EXACT package structure and naming conventions from the project documentation
- Follow the architectural patterns and coding standards defined in the guidelines
- Use the same annotation styles and field types as existing entities in the project

## Entity Requirements:
**Entity Name:** ${entityName}
**Detailed Requirements:** ${requirements}

## Project Context:
- Package: ${codebaseContext.packageName || 'com.example.demo'}.model
- Framework: Spring Boot with JPA/Hibernate
- Database: ${codebaseContext.database || 'H2/MySQL'}

## Existing Entities in Project:
${codebaseContext.entities && codebaseContext.entities.length > 0 
  ? codebaseContext.entities.map((e: any) => `- ${e.name}: [${e.fields ? e.fields.join(', ') : 'Unknown fields'}]`).join('\n')
  : '- No existing entities found'}

## CODE GENERATION REQUIREMENTS:
1. **CRITICAL**: Follow ALL patterns and conventions from the development guidelines above
2. **ENTITY REQUIREMENTS**:
   - Analyze requirements to extract appropriate fields and determine smart data types
   - Use String for text, Integer for numbers/ages, BigDecimal for prices/amounts, LocalDateTime for dates, Boolean for flags
   - Add comprehensive validation annotations (@NotBlank, @Size, @Email, @Min, @DecimalMin, @PastOrPresent)
   - Include audit fields (createdAt, updatedAt) with @PreUpdate lifecycle method
   - Generate proper constructors (default + parameterized), equals/hashCode, toString methods
   - Add @Column annotations for explicit database mapping
   - Use jakarta.persistence annotations (not javax)
   - Follow project's exact coding standards and import patterns

## OUTPUT FORMAT:
Generate ONLY the complete Java class code without markdown formatting, explanations, or comments. The code should be production-ready and follow the project's exact coding standards.`;

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
    
    const prompt = `You are an expert Java Spring Boot developer working on an existing project. Generate a complete repository interface that follows the project's specific guidelines and patterns.

${projectDocs}

## IMPORTANT: 
- STRICTLY FOLLOW the development guidelines and patterns specified above
- Use the EXACT package structure and naming conventions from the project documentation
- Follow the repository patterns and conventions defined in the guidelines
- Use the same query method naming and annotation styles as existing repositories

## Repository Requirements:
**Entity:** ${entityName}
**Detailed Requirements:** ${requirements}

## Project Context:
- Repository Package: ${codebaseContext.packageName || 'com.example.demo'}.repository
- Entity Package: ${codebaseContext.packageName || 'com.example.demo'}.model
- ID Type: ${codebaseContext.entityIdType || 'Long'}

## Existing Repositories in Project:
${codebaseContext.repositories && codebaseContext.repositories.length > 0 
  ? codebaseContext.repositories.map((r: any) => `- ${r.name}: [${r.methods ? r.methods.join(', ') : 'Standard CRUD'}]`).join('\n')
  : '- No existing repositories found'}

## CODE GENERATION REQUIREMENTS:
1. **CRITICAL**: Follow ALL patterns and conventions from the development guidelines above
2. **REPOSITORY REQUIREMENTS**:
   - Create interface extending JpaRepository<${entityName}, ${codebaseContext.entityIdType || 'Long'}> with @Repository annotation
   - Analyze requirements to determine custom query methods needed based on entity fields
   - Generate field-specific methods: findBy[FieldName], findBy[FieldName]ContainingIgnoreCase
   - Add ordering methods: findAllByOrderBy[Field]Asc/Desc
   - Include utility methods: existsById, countAll
   - Add @Query annotations for complex custom queries with @Param parameters
   - Use proper method naming conventions following Spring Data JPA patterns
   - Include comprehensive JavaDoc comments for all custom methods
   - Follow project's repository patterns and conventions

## OUTPUT FORMAT:
Generate ONLY the complete Java interface code without markdown formatting, explanations, or comments. The code should be production-ready and follow the project's exact coding standards.`;

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
    // Read project documentation for better context
    const projectDocs = await this.readProjectDocumentation(codebaseContext.repoPath);
    
    const prompt = `You are an expert Java Spring Boot developer working on an existing project. Generate a complete service class that follows the project's specific guidelines and patterns.

${projectDocs}

## IMPORTANT: 
- STRICTLY FOLLOW the development guidelines and patterns specified above
- Use the EXACT package structure and naming conventions from the project documentation
- Follow the service layer patterns and business logic conventions defined in the guidelines
- Use the same dependency injection and transaction management styles as existing services

## Service Requirements:
**Entity:** ${entityName}
**Detailed Requirements:** ${requirements}

## Project Context:
- Service Package: ${codebaseContext.packageName || 'com.example.demo'}.service
- Entity Package: ${codebaseContext.packageName || 'com.example.demo'}.model
- Repository Package: ${codebaseContext.packageName || 'com.example.demo'}.repository

## Existing Services in Project:
${codebaseContext.services && codebaseContext.services.length > 0 
  ? codebaseContext.services.map((s: any) => `- ${s.name}: [${s.methods ? s.methods.join(', ') : 'Standard CRUD'}]`).join('\n')
  : '- No existing services found'}

## CODE GENERATION REQUIREMENTS:
1. **CRITICAL**: Follow ALL patterns and conventions from the development guidelines above
2. **SERVICE REQUIREMENTS**:
   - Create service class with @Service and @Transactional annotations
   - Use constructor injection for ${entityName}Repository (modern Spring Boot best practice)
   - Implement complete CRUD operations: findAll, findById (Optional<>), save, update, deleteById, existsById, count
   - Add @Transactional(readOnly = true) for query methods to optimize performance
   - Include comprehensive validation with IllegalArgumentException for null inputs
   - Use proper exception handling with RuntimeException for "not found" scenarios
   - Add meaningful error messages and comprehensive JavaDoc comments
   - Follow business logic patterns and validation conventions from project guidelines
   - Ensure all methods handle edge cases and provide clear error messages

## OUTPUT FORMAT:
Generate ONLY the complete Java class code without markdown formatting, explanations, or comments. The code should be production-ready and follow the project's exact coding standards.`;

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
    // Read project documentation for better context
    const projectDocs = await this.readProjectDocumentation(codebaseContext.repoPath);
    
    const prompt = `You are an expert Java Spring Boot developer working on an existing project. Generate a complete REST controller class that follows the project's specific guidelines and patterns.

${projectDocs}

## IMPORTANT: 
- STRICTLY FOLLOW the development guidelines and patterns specified above
- Use the EXACT package structure and naming conventions from the project documentation
- Follow the REST API patterns and endpoint conventions defined in the guidelines
- Use the same request/response handling and error management styles as existing controllers

## Controller Requirements:
**Entity:** ${entityName}
**Detailed Requirements:** ${requirements}

## Project Context:
- Controller Package: ${codebaseContext.packageName || 'com.example.demo'}.controller
- Service Package: ${codebaseContext.packageName || 'com.example.demo'}.service
- Entity Package: ${codebaseContext.packageName || 'com.example.demo'}.model

## Existing Controllers in Project:
${codebaseContext.controllers && codebaseContext.controllers.length > 0 
  ? codebaseContext.controllers.map((c: any) => `- ${c.name}: [${c.requestMethods ? c.requestMethods.join(', ') : 'Standard REST endpoints'}]`).join('\n')
  : '- No existing controllers found'}

## CODE GENERATION REQUIREMENTS:
1. **CRITICAL**: Follow ALL patterns and conventions from the development guidelines above
2. **CONTROLLER REQUIREMENTS**:
   - Create REST controller class with @RestController, @RequestMapping, @CrossOrigin, @Validated annotations
   - Use constructor injection for ${entityName}Service (modern Spring Boot best practice)
   - Implement complete REST API endpoints:
     * GET /api/${entityName.toLowerCase()}s - findAll (returns List<${entityName}>)
     * GET /api/${entityName.toLowerCase()}s/{id} - findById (returns Optional, 404 if not found)
     * POST /api/${entityName.toLowerCase()}s - create (returns 201 Created)
     * PUT /api/${entityName.toLowerCase()}s/{id} - update (returns 200 OK or 404)
     * DELETE /api/${entityName.toLowerCase()}s/{id} - delete (returns 204 No Content or 404)
     * GET /api/${entityName.toLowerCase()}s/{id}/exists - check existence
     * GET /api/${entityName.toLowerCase()}s/count - get total count
   - Use ResponseEntity with proper HTTP status codes (200, 201, 204, 400, 404, 500)
   - Add comprehensive exception handling with try-catch blocks for all methods
   - Include @Valid and @NotNull annotations for request validation
   - Add detailed JavaDoc comments for all endpoints
   - Follow REST API best practices and project's error handling conventions

## OUTPUT FORMAT:
Generate ONLY the complete Java class code without markdown formatting, explanations, or comments. The code should be production-ready and follow the project's exact coding standards.`;

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
        const result = match[1].charAt(0).toUpperCase() + match[1].slice(1);
        return result;
      }
    }
    
    return 'DefaultEntity';
  }

  private generateEntityTemplate(entityName: string, context: any): string {
    // Try to extract fields from the original context if available
    let fields = ['name']; // Default field
    
    // Look for field specifications in the context
    if (context.originalRequirements || context.requirements) {
      const requirementsText = context.originalRequirements || context.requirements || '';
      const fieldMatches = requirementsText.match(/fields?\s*:?\s*([^.!?\n]*)/gi);
      
      if (fieldMatches && fieldMatches[0]) {
        const fieldsText = fieldMatches[0].replace(/fields?\s*:?\s*/i, '');
        const extractedFields = fieldsText.split(/[,\s]+/)
          .map((f: string) => f.trim())
          .filter((f: string) => f && f.length > 0 && !/^(and|with|the|a|an)$/i.test(f));
        
        if (extractedFields.length > 0) {
          fields = extractedFields;
        }
      }
    }
    
    // Generate field declarations with appropriate types and validation
    const fieldDeclarations = fields.map((field: string) => {
      // Determine field type based on common naming patterns
      let fieldType = 'String';
      let validationAnnotations = '';
      
      if (field.toLowerCase().includes('email')) {
        fieldType = 'String';
        validationAnnotations = '    @Email(message = "Invalid email format")\n';
      } else if (field.toLowerCase().includes('age') || field.toLowerCase().includes('count') || field.toLowerCase().includes('number')) {
        fieldType = 'Integer';
        validationAnnotations = '    @Min(value = 0, message = "Value must be positive")\n';
      } else if (field.toLowerCase().includes('price') || field.toLowerCase().includes('amount') || field.toLowerCase().includes('salary')) {
        fieldType = 'BigDecimal';
        validationAnnotations = '    @DecimalMin(value = "0.0", inclusive = false, message = "Value must be positive")\n';
      } else if (field.toLowerCase().includes('date') || field.toLowerCase().includes('time')) {
        fieldType = 'LocalDateTime';
        validationAnnotations = '    @PastOrPresent(message = "Date cannot be in the future")\n';
      } else if (field.toLowerCase().includes('active') || field.toLowerCase().includes('enabled') || field.toLowerCase().includes('deleted')) {
        fieldType = 'Boolean';
        validationAnnotations = '';
      } else {
        // Default string validation
        validationAnnotations = '    @NotBlank(message = "Field cannot be blank")\n    @Size(max = 255, message = "Field must not exceed 255 characters")\n';
      }
      
      return `${validationAnnotations}    @Column(name = "${field.toLowerCase()}")
    private ${fieldType} ${field};`;
    }).join('\n\n');
    
    // Generate getters and setters
    const gettersSetters = fields.map((field: string) => {
      const capitalizedField = field.charAt(0).toUpperCase() + field.slice(1);
      let fieldType = 'String';
      
      // Use same type logic as above
      if (field.toLowerCase().includes('age') || field.toLowerCase().includes('count') || field.toLowerCase().includes('number')) {
        fieldType = 'Integer';
      } else if (field.toLowerCase().includes('price') || field.toLowerCase().includes('amount') || field.toLowerCase().includes('salary')) {
        fieldType = 'BigDecimal';
      } else if (field.toLowerCase().includes('date') || field.toLowerCase().includes('time')) {
        fieldType = 'LocalDateTime';
      } else if (field.toLowerCase().includes('active') || field.toLowerCase().includes('enabled') || field.toLowerCase().includes('deleted')) {
        fieldType = 'Boolean';
      }
      
      return `    
    public ${fieldType} get${capitalizedField}() { 
        return ${field}; 
    }
    
    public void set${capitalizedField}(${fieldType} ${field}) { 
        this.${field} = ${field}; 
    }`;
    }).join('');

    return `package ${context.packageName || 'com.example.demo'}.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.time.LocalDateTime;
import java.math.BigDecimal;
import java.util.Objects;

/**
 * ${entityName} entity class.
 * Represents ${entityName.toLowerCase()} data in the database.
 */
@Entity
@Table(name = "${entityName.toLowerCase()}s")
public class ${entityName} {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;
    
${fieldDeclarations}
    
    @Column(name = "created_at")
    private LocalDateTime createdAt;
    
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
    
    // Constructors
    public ${entityName}() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }
    
    public ${entityName}(${fields.map((field: string) => {
      let fieldType = 'String';
      if (field.toLowerCase().includes('age') || field.toLowerCase().includes('count') || field.toLowerCase().includes('number')) {
        fieldType = 'Integer';
      } else if (field.toLowerCase().includes('price') || field.toLowerCase().includes('amount') || field.toLowerCase().includes('salary')) {
        fieldType = 'BigDecimal';
      } else if (field.toLowerCase().includes('date') || field.toLowerCase().includes('time')) {
        fieldType = 'LocalDateTime';
      } else if (field.toLowerCase().includes('active') || field.toLowerCase().includes('enabled') || field.toLowerCase().includes('deleted')) {
        fieldType = 'Boolean';
      }
      return `${fieldType} ${field}`;
    }).join(', ')}) {
        this();
        ${fields.map((field: string) => `this.${field} = ${field};`).join('\n        ')}
    }
    
    // JPA lifecycle methods
    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
    
    // ID getter/setter
    public Long getId() { 
        return id; 
    }
    
    public void setId(Long id) { 
        this.id = id; 
    }
${gettersSetters}
    
    // Timestamp getters/setters
    public LocalDateTime getCreatedAt() { 
        return createdAt; 
    }
    
    public void setCreatedAt(LocalDateTime createdAt) { 
        this.createdAt = createdAt; 
    }
    
    public LocalDateTime getUpdatedAt() { 
        return updatedAt; 
    }
    
    public void setUpdatedAt(LocalDateTime updatedAt) { 
        this.updatedAt = updatedAt; 
    }
    
    // equals and hashCode
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ${entityName} ${entityName.toLowerCase()} = (${entityName}) o;
        return Objects.equals(id, ${entityName.toLowerCase()}.id);
    }
    
    @Override
    public int hashCode() {
        return Objects.hash(id);
    }
    
    // toString
    @Override
    public String toString() {
        return "${entityName}{" +
                "id=" + id +
                ${fields.map((field: string) => `", ${field}='" + ${field} + '\\''`).join(' +\n                ')} +
                ", createdAt=" + createdAt +
                ", updatedAt=" + updatedAt +
                '}';
    }
}`;
  }

  private generateRepositoryTemplate(entityName: string, context: any): string {
    // Try to extract field names from context for custom queries
    let customQueries = '';
    
    if (context.originalRequirements || context.requirements) {
      const requirementsText = context.originalRequirements || context.requirements || '';
      const fieldMatches = requirementsText.match(/fields?\s*:?\s*([^.!?\n]*)/gi);
      
      if (fieldMatches && fieldMatches[0]) {
        const fieldsText = fieldMatches[0].replace(/fields?\s*:?\s*/i, '');
        const extractedFields = fieldsText.split(/[,\s]+/)
          .map((f: string) => f.trim())
          .filter((f: string) => f && f.length > 0 && !/^(and|with|the|a|an)$/i.test(f));
        
        if (extractedFields.length > 0) {
          customQueries = extractedFields.map((field: string) => {
            const capitalizedField = field.charAt(0).toUpperCase() + field.slice(1);
            return `    
    /**
     * Find ${entityName.toLowerCase()} entities by ${field}.
     * @param ${field} The ${field} to search for
     * @return List of ${entityName.toLowerCase()} entities matching the ${field}
     */
    List<${entityName}> findBy${capitalizedField}(String ${field});
    
    /**
     * Find ${entityName.toLowerCase()} entities by ${field} containing the given text.
     * @param ${field} The ${field} text to search for
     * @return List of ${entityName.toLowerCase()} entities containing the ${field}
     */
    List<${entityName}> findBy${capitalizedField}ContainingIgnoreCase(String ${field});`;
          }).join('\n');
        }
      }
    }

    return `package ${context.packageName || 'com.example.demo'}.repository;

import ${context.packageName || 'com.example.demo'}.model.${entityName};
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

/**
 * Repository interface for ${entityName} entity.
 * Provides CRUD operations and custom queries.
 */
@Repository
public interface ${entityName}Repository extends JpaRepository<${entityName}, Long> {
    
    /**
     * Check if ${entityName.toLowerCase()} exists by ID.
     * @param id The ID to check
     * @return true if ${entityName.toLowerCase()} exists, false otherwise
     */
    boolean existsById(Long id);
    
    /**
     * Find all ${entityName.toLowerCase()} entities ordered by ID.
     * @return List of ${entityName.toLowerCase()} entities ordered by ID ascending
     */
    List<${entityName}> findAllByOrderByIdAsc();
    
    /**
     * Find all ${entityName.toLowerCase()} entities ordered by ID descending.
     * @return List of ${entityName.toLowerCase()} entities ordered by ID descending
     */
    List<${entityName}> findAllByOrderByIdDesc();${customQueries}
    
    /**
     * Custom query to count entities.
     * @return Total count of ${entityName.toLowerCase()} entities
     */
    @Query("SELECT COUNT(e) FROM ${entityName} e")
    long countAll();
    
    /**
     * Custom query example - customize based on your needs.
     * @param keyword The keyword to search for
     * @return List of ${entityName.toLowerCase()} entities matching the search
     */
    @Query("SELECT e FROM ${entityName} e WHERE LOWER(e.name) LIKE LOWER(CONCAT('%', :keyword, '%'))")
    List<${entityName}> findByKeyword(@Param("keyword") String keyword);
}`;
  }

  private generateServiceTemplate(entityName: string, context: any): string {
    return `package ${context.packageName || 'com.example.demo'}.service;

import ${context.packageName || 'com.example.demo'}.model.${entityName};
import ${context.packageName || 'com.example.demo'}.repository.${entityName}Repository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import java.util.List;
import java.util.Optional;

/**
 * Service class for ${entityName} entity operations.
 * Provides business logic and CRUD operations.
 */
@Service
@Transactional
public class ${entityName}Service {
    
    private final ${entityName}Repository ${entityName.toLowerCase()}Repository;
    
    @Autowired
    public ${entityName}Service(${entityName}Repository ${entityName.toLowerCase()}Repository) {
        this.${entityName.toLowerCase()}Repository = ${entityName.toLowerCase()}Repository;
    }
    
    /**
     * Retrieve all ${entityName.toLowerCase()} entities.
     * @return List of all ${entityName.toLowerCase()} entities
     */
    @Transactional(readOnly = true)
    public List<${entityName}> findAll() {
        return ${entityName.toLowerCase()}Repository.findAll();
    }
    
    /**
     * Find ${entityName.toLowerCase()} by ID.
     * @param id The ID of the ${entityName.toLowerCase()} to find
     * @return Optional containing the ${entityName.toLowerCase()} if found
     */
    @Transactional(readOnly = true)
    public Optional<${entityName}> findById(Long id) {
        if (id == null) {
            throw new IllegalArgumentException("ID cannot be null");
        }
        return ${entityName.toLowerCase()}Repository.findById(id);
    }
    
    /**
     * Save a new ${entityName.toLowerCase()} entity.
     * @param ${entityName.toLowerCase()} The ${entityName.toLowerCase()} entity to save
     * @return The saved ${entityName.toLowerCase()} entity
     */
    public ${entityName} save(${entityName} ${entityName.toLowerCase()}) {
        if (${entityName.toLowerCase()} == null) {
            throw new IllegalArgumentException("${entityName} cannot be null");
        }
        return ${entityName.toLowerCase()}Repository.save(${entityName.toLowerCase()});
    }
    
    /**
     * Update an existing ${entityName.toLowerCase()} entity.
     * @param id The ID of the ${entityName.toLowerCase()} to update
     * @param ${entityName.toLowerCase()}Details The updated ${entityName.toLowerCase()} details
     * @return The updated ${entityName.toLowerCase()} entity
     * @throws RuntimeException if ${entityName.toLowerCase()} not found
     */
    public ${entityName} update(Long id, ${entityName} ${entityName.toLowerCase()}Details) {
        if (id == null) {
            throw new IllegalArgumentException("ID cannot be null");
        }
        if (${entityName.toLowerCase()}Details == null) {
            throw new IllegalArgumentException("${entityName} details cannot be null");
        }
        
        return ${entityName.toLowerCase()}Repository.findById(id)
            .map(existing${entityName} -> {
                // Update fields here - customize based on entity fields
                return ${entityName.toLowerCase()}Repository.save(existing${entityName});
            })
            .orElseThrow(() -> new RuntimeException("${entityName} not found with id: " + id));
    }
    
    /**
     * Delete a ${entityName.toLowerCase()} entity by ID.
     * @param id The ID of the ${entityName.toLowerCase()} to delete
     * @throws RuntimeException if ${entityName.toLowerCase()} not found
     */
    public void deleteById(Long id) {
        if (id == null) {
            throw new IllegalArgumentException("ID cannot be null");
        }
        
        if (!${entityName.toLowerCase()}Repository.existsById(id)) {
            throw new RuntimeException("${entityName} not found with id: " + id);
        }
        
        ${entityName.toLowerCase()}Repository.deleteById(id);
    }
    
    /**
     * Check if ${entityName.toLowerCase()} exists by ID.
     * @param id The ID to check
     * @return true if ${entityName.toLowerCase()} exists, false otherwise
     */
    @Transactional(readOnly = true)
    public boolean existsById(Long id) {
        if (id == null) {
            return false;
        }
        return ${entityName.toLowerCase()}Repository.existsById(id);
    }
    
    /**
     * Count all ${entityName.toLowerCase()} entities.
     * @return Total count of ${entityName.toLowerCase()} entities
     */
    @Transactional(readOnly = true)
    public long count() {
        return ${entityName.toLowerCase()}Repository.count();
    }
}`;
  }

  private generateControllerTemplate(entityName: string, context: any): string {
    const lowerEntity = entityName.toLowerCase();
    const pluralEntity = `${lowerEntity}s`;
    
    return `package ${context.packageName || 'com.example.demo'}.controller;

import ${context.packageName || 'com.example.demo'}.model.${entityName};
import ${context.packageName || 'com.example.demo'}.service.${entityName}Service;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.validation.annotation.Validated;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.Optional;

/**
 * REST Controller for ${entityName} entity operations.
 * Provides RESTful API endpoints for ${entityName} management.
 */
@RestController
@RequestMapping("/api/${pluralEntity}")
@CrossOrigin(origins = "*")
@Validated
public class ${entityName}Controller {
    
    private final ${entityName}Service ${lowerEntity}Service;
    
    @Autowired
    public ${entityName}Controller(${entityName}Service ${lowerEntity}Service) {
        this.${lowerEntity}Service = ${lowerEntity}Service;
    }
    
    /**
     * Get all ${pluralEntity}.
     * @return List of all ${pluralEntity} with HTTP 200 OK
     */
    @GetMapping
    public ResponseEntity<List<${entityName}>> getAllEntities() {
        try {
            List<${entityName}> ${pluralEntity} = ${lowerEntity}Service.findAll();
            return ResponseEntity.ok(${pluralEntity});
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Get ${lowerEntity} by ID.
     * @param id The ID of the ${lowerEntity} to retrieve
     * @return ${entityName} entity with HTTP 200 OK, or HTTP 404 Not Found
     */
    @GetMapping("/{id}")
    public ResponseEntity<${entityName}> getEntityById(@PathVariable @NotNull Long id) {
        try {
            Optional<${entityName}> ${lowerEntity} = ${lowerEntity}Service.findById(id);
            return ${lowerEntity}.map(entity -> ResponseEntity.ok().body(entity))
                    .orElse(ResponseEntity.notFound().build());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Create a new ${lowerEntity}.
     * @param ${lowerEntity} The ${lowerEntity} entity to create
     * @return Created ${lowerEntity} with HTTP 201 Created
     */
    @PostMapping
    public ResponseEntity<${entityName}> createEntity(@Valid @RequestBody ${entityName} ${lowerEntity}) {
        try {
            ${entityName} saved${entityName} = ${lowerEntity}Service.save(${lowerEntity});
            return ResponseEntity.status(HttpStatus.CREATED).body(saved${entityName});
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Update an existing ${lowerEntity}.
     * @param id The ID of the ${lowerEntity} to update
     * @param ${lowerEntity}Details The updated ${lowerEntity} details
     * @return Updated ${lowerEntity} with HTTP 200 OK, or HTTP 404 Not Found
     */
    @PutMapping("/{id}")
    public ResponseEntity<${entityName}> updateEntity(@PathVariable @NotNull Long id, 
                                                     @Valid @RequestBody ${entityName} ${lowerEntity}Details) {
        try {
            ${entityName} updated${entityName} = ${lowerEntity}Service.update(id, ${lowerEntity}Details);
            return ResponseEntity.ok(updated${entityName});
        } catch (RuntimeException e) {
            if (e.getMessage().contains("not found")) {
                return ResponseEntity.notFound().build();
            }
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Delete ${lowerEntity} by ID.
     * @param id The ID of the ${lowerEntity} to delete
     * @return HTTP 204 No Content on success, or HTTP 404 Not Found
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteEntity(@PathVariable @NotNull Long id) {
        try {
            ${lowerEntity}Service.deleteById(id);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            if (e.getMessage().contains("not found")) {
                return ResponseEntity.notFound().build();
            }
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Check if ${lowerEntity} exists by ID.
     * @param id The ID to check
     * @return HTTP 200 OK if exists, HTTP 404 Not Found if not
     */
    @GetMapping("/{id}/exists")
    public ResponseEntity<Boolean> existsById(@PathVariable @NotNull Long id) {
        try {
            boolean exists = ${lowerEntity}Service.existsById(id);
            return ResponseEntity.ok(exists);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Get count of all ${pluralEntity}.
     * @return Total count with HTTP 200 OK
     */
    @GetMapping("/count")
    public ResponseEntity<Long> getCount() {
        try {
            long count = ${lowerEntity}Service.count();
            return ResponseEntity.ok(count);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
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
      // Read Copilot instructions FIRST (highest priority for development guidelines)
      try {
        const copilotPath = path.join(basePath, '.github', 'copilot-instructions.md');
        const copilotInstructions = await fs.readFile(copilotPath, 'utf-8');
        documentation += `## CRITICAL DEVELOPMENT GUIDELINES (MUST FOLLOW):\n${copilotInstructions}\n\n`;
      } catch {
        // Copilot instructions not found
      }

      // Read README.md for project context (increased limit)
      try {
        const readmePath = path.join(basePath, 'README.md');
        const readme = await fs.readFile(readmePath, 'utf-8');
        documentation += `## Project Overview and Architecture:\n${readme.substring(0, 5000)}\n\n`;
      } catch {
        // README not found or accessible
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

      // Try to read pom.xml for Maven projects (for Java package structure)
      try {
        const pomPath = path.join(basePath, 'pom.xml');
        const pomContent = await fs.readFile(pomPath, 'utf-8');
        // Extract groupId and artifactId for package structure
        const groupIdMatch = pomContent.match(/<groupId>(.*?)<\/groupId>/);
        const artifactIdMatch = pomContent.match(/<artifactId>(.*?)<\/artifactId>/);
        if (groupIdMatch && artifactIdMatch) {
          documentation += `## Maven Project Structure:\n`;
          documentation += `- Group ID: ${groupIdMatch[1]}\n`;
          documentation += `- Artifact ID: ${artifactIdMatch[1]}\n`;
          documentation += `- Package Base: ${groupIdMatch[1]}.${artifactIdMatch[1]}\n\n`;
        }
      } catch {
        // pom.xml not found
      }

    } catch (error) {
      console.log('⚠️ Could not read project documentation:', (error as Error).message);
    }

    return documentation || '## Project Documentation:\nNo documentation found. Use standard Spring Boot conventions.\n\n';
  }

  public isAIEnabled(): boolean {
    return this.isEnabled;
  }

  public getServiceType(): string {
    return this.serviceType;
  }
}
