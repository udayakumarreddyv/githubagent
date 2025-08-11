import path from 'path';
import fs from 'fs/promises';
import { execSync } from 'child_process';
import { FreeAIService } from '../services/FreeAIService';

export interface TestMetrics {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  executionTime: number;
  coverage: {
    linePercentage: number;
    branchPercentage: number;
    methodPercentage: number;
  };
}

export interface TestResult {
  success: boolean;
  metrics: TestMetrics;
  generatedTestFiles: string[];
  testReport: string;
  failureDetails?: string[];
  coverageReport?: string;
}

export interface TestRequirements {
  testTypes: ('unit' | 'integration' | 'e2e')[];
  coverageThreshold: number;
  mockingRequired: boolean;
  testDataRequired: boolean;
  performanceTestsRequired: boolean;
}

export class TestAgent {
  private aiService: FreeAIService;
  private static readonly JUNIT_VERSION = '5.9.2';
  private static readonly MOCKITO_VERSION = '5.1.1';
  private static readonly JACOCO_VERSION = '0.8.8';

  constructor() {
    this.aiService = new FreeAIService();
  }

  /**
   * Main entry point for test generation and execution
   */
  async generateAndExecuteTests(
    issueData: any,
    implementedFiles: string[],
    repoPath: string,
    codebaseStructure: any
  ): Promise<TestResult> {
    console.log('🧪 Starting TestAgent: Generating and executing tests...');
    
    try {
      // Analyze what tests are needed
      const testRequirements = await this.analyzeTestRequirements(issueData, implementedFiles, codebaseStructure);
      
      // Generate test files
      const generatedTestFiles = await this.generateTestFiles(
        implementedFiles,
        repoPath,
        codebaseStructure,
        testRequirements
      );

      // Ensure test dependencies are configured
      await this.ensureTestDependencies(repoPath);

      // Execute tests
      const testMetrics = await this.executeTests(repoPath);

      // Generate coverage report
      const coverageReport = await this.generateCoverageReport(repoPath);

      return {
        success: testMetrics.failedTests === 0,
        metrics: testMetrics,
        generatedTestFiles,
        testReport: this.formatTestReport(testMetrics),
        coverageReport
      };

    } catch (error) {
      console.error('❌ TestAgent failed:', error);
      return {
        success: false,
        metrics: this.getDefaultMetrics(),
        generatedTestFiles: [],
        testReport: 'Test execution failed',
        failureDetails: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  /**
   * Analyze what types of tests are needed based on the code changes
   */
  private async analyzeTestRequirements(
    issueData: any,
    implementedFiles: string[],
    codebaseStructure: any
  ): Promise<TestRequirements> {
    console.log('🔍 Analyzing test requirements...');

    const requirements: TestRequirements = {
      testTypes: ['unit'],
      coverageThreshold: 80,
      mockingRequired: false,
      testDataRequired: false,
      performanceTestsRequired: false
    };

    // Analyze file types and complexity
    for (const filePath of implementedFiles) {
      const fileContent = await fs.readFile(filePath, 'utf8');
      
      // Check if it's a controller (needs integration tests)
      if (filePath.includes('controller') || fileContent.includes('@RestController')) {
        requirements.testTypes.push('integration');
      }

      // Check if it uses external dependencies (needs mocking)
      if (fileContent.includes('@Autowired') || fileContent.includes('@Service') || fileContent.includes('@Repository')) {
        requirements.mockingRequired = true;
      }

      // Check if it has complex business logic (needs thorough testing)
      if (fileContent.includes('calculate') || fileContent.includes('process') || fileContent.includes('validate')) {
        requirements.coverageThreshold = 90;
      }

      // Check for data operations (needs test data)
      if (fileContent.includes('JpaRepository') || fileContent.includes('@Entity')) {
        requirements.testDataRequired = true;
      }
    }

    return requirements;
  }

  /**
   * Generate comprehensive test files for the implemented code
   */
  private async generateTestFiles(
    implementedFiles: string[],
    repoPath: string,
    codebaseStructure: any,
    requirements: TestRequirements
  ): Promise<string[]> {
    console.log('📝 Generating test files...');
    
    const generatedFiles: string[] = [];
    const testSourcePath = path.join(repoPath, 'src', 'test', 'java');
    const packagePath = codebaseStructure.projectConventions?.packageStructure?.replace(/\./g, '/') || 'com/example/demo';

    for (const implementedFile of implementedFiles) {
      const className = this.extractClassName(implementedFile);
      const testClassName = `${className}Test`;
      
      let testCode: string;

      if (this.aiService.isAIEnabled()) {
        // Use AI to generate comprehensive tests
        testCode = await this.generateTestWithAI(implementedFile, requirements, codebaseStructure);
      } else {
        // Fallback to template-based test generation
        testCode = this.generateTestTemplate(className, implementedFile, requirements);
      }

      // Determine test package based on source file location
      let testPackage = `${packagePath}`;
      if (implementedFile.includes('controller')) {
        testPackage += '/controller';
      } else if (implementedFile.includes('service')) {
        testPackage += '/service';
      } else if (implementedFile.includes('repository')) {
        testPackage += '/repository';
      } else if (implementedFile.includes('model')) {
        testPackage += '/model';
      }

      const testFilePath = await this.writeTestFile(testSourcePath, testPackage, `${testClassName}.java`, testCode);
      if (testFilePath) {
        generatedFiles.push(testFilePath);
      }
    }

    // Generate integration test if needed
    if (requirements.testTypes.includes('integration')) {
      const integrationTestCode = await this.generateIntegrationTest(implementedFiles, codebaseStructure, requirements);
      const integrationTestPath = await this.writeTestFile(
        testSourcePath,
        `${packagePath}/integration`,
        'IntegrationTest.java',
        integrationTestCode
      );
      if (integrationTestPath) {
        generatedFiles.push(integrationTestPath);
      }
    }

    return generatedFiles;
  }

  /**
   * Generate test code using AI
   */
  private async generateTestWithAI(
    implementedFile: string,
    requirements: TestRequirements,
    codebaseStructure: any
  ): Promise<string> {
    const sourceCode = await fs.readFile(implementedFile, 'utf8');
    const className = this.extractClassName(implementedFile);

    const prompt = `Generate comprehensive JUnit 5 test for the following Java class:

${sourceCode}

Requirements:
- Use JUnit 5 annotations (@Test, @BeforeEach, @AfterEach)
- Target coverage: ${requirements.coverageThreshold}%
- Mocking required: ${requirements.mockingRequired ? 'Yes (use @MockBean for Spring)' : 'No'}
- Test data needed: ${requirements.testDataRequired ? 'Yes (use @Sql or test data builders)' : 'No'}
- Include edge cases and error scenarios
- Use AssertJ for assertions
- Follow Spring Boot testing best practices
- Test class name: ${className}Test

Generate complete, production-ready test code.`;

    try {
      // Use the available AI service method for code generation
      const aiGeneratedTest = await this.aiService.generateJavaEntityWithAI(
        className,
        prompt,
        { description: 'Generate comprehensive JUnit test class' }
      );
      return this.cleanupGeneratedCode(aiGeneratedTest);
    } catch (error) {
      console.warn('⚠️ AI test generation failed, using template');
      return this.generateTestTemplate(className, implementedFile, requirements);
    }
  }

  /**
   * Generate basic test template as fallback
   */
  private generateTestTemplate(className: string, implementedFile: string, requirements: TestRequirements): string {
    const packageName = this.extractPackageName(implementedFile);
    const isController = implementedFile.includes('controller');
    const isService = implementedFile.includes('service');
    const isRepository = implementedFile.includes('repository');

    let imports = `package ${packageName};

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import static org.assertj.core.api.Assertions.*;`;

    if (isController) {
      imports += `
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;`;
    }

    if (isService && requirements.mockingRequired) {
      imports += `
import org.mockito.Mock;
import org.mockito.InjectMocks;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import static org.mockito.Mockito.*;`;
    }

    if (isRepository) {
      imports += `
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.junit.jupiter.SpringJUnitTest;`;
    }

    let testClass = `

@DisplayName("${className} Tests")`;

    if (isController) {
      testClass += `
@WebMvcTest(${className}.class)`;
    } else if (isService && requirements.mockingRequired) {
      testClass += `
@ExtendWith(MockitoExtension.class)`;
    } else if (isRepository) {
      testClass += `
@DataJpaTest`;
    }

    testClass += `
class ${className}Test {
`;

    if (isController) {
      testClass += `
    @Autowired
    private MockMvc mockMvc;
    
    @MockBean
    private ${className.replace('Controller', 'Service')} service;`;
    } else if (isService && requirements.mockingRequired) {
      testClass += `
    @Mock
    private ${className.replace('Service', 'Repository')} repository;
    
    @InjectMocks
    private ${className} service;`;
    }

    testClass += `

    @BeforeEach
    void setUp() {
        // Initialize test data and mocks
    }

    @Test
    @DisplayName("Should perform basic functionality test")
    void shouldPerformBasicFunctionalityTest() {
        // Arrange - Setup test data and expectations
        
        // Act - Execute the functionality under test
        
        // Assert - Verify the expected behavior
        // TODO: Implement specific assertions based on the component being tested
    }

    @Test
    @DisplayName("Should handle edge cases")
    void shouldHandleEdgeCases() {
        // Test edge cases and error scenarios
        // TODO: Implement edge case testing (null values, empty collections, boundary conditions)
    }

    @Test
    @DisplayName("Should validate input parameters")
    void shouldValidateInputParameters() {
        // Test input validation
        // TODO: Implement parameter validation testing
    }
}`;

    return imports + testClass;
  }

  /**
   * Generate integration test
   */
  private async generateIntegrationTest(
    implementedFiles: string[],
    codebaseStructure: any,
    requirements: TestRequirements
  ): Promise<string> {
    const packageName = codebaseStructure.projectConventions?.packageStructure || 'com.example.demo';

    return `package ${packageName}.integration;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureWebMvc;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureWebMvc
@TestPropertySource(locations = "classpath:application-test.properties")
class IntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void shouldPerformEndToEndWorkflow() throws Exception {
        // Test complete workflow integration
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk());
    }
}`;
  }

  /**
   * Ensure Maven/Gradle test dependencies are configured
   */
  private async ensureTestDependencies(repoPath: string): Promise<void> {
    console.log('🔧 Ensuring test dependencies are configured...');
    
    const pomPath = path.join(repoPath, 'pom.xml');
    
    try {
      const pomContent = await fs.readFile(pomPath, 'utf8');
      
      // Check if test dependencies are already present
      if (!pomContent.includes('spring-boot-starter-test')) {
        console.log('📦 Adding missing test dependencies to pom.xml...');
        
        const testDependencies = `
    <!-- Test Dependencies -->
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-test</artifactId>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>org.junit.jupiter</groupId>
      <artifactId>junit-jupiter</artifactId>
      <version>${TestAgent.JUNIT_VERSION}</version>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>org.mockito</groupId>
      <artifactId>mockito-core</artifactId>
      <version>${TestAgent.MOCKITO_VERSION}</version>
      <scope>test</scope>
    </dependency>`;

        const jaccocoPlugin = `
      <!-- JaCoCo Coverage Plugin -->
      <plugin>
        <groupId>org.jacoco</groupId>
        <artifactId>jacoco-maven-plugin</artifactId>
        <version>${TestAgent.JACOCO_VERSION}</version>
        <executions>
          <execution>
            <goals>
              <goal>prepare-agent</goal>
            </goals>
          </execution>
          <execution>
            <id>report</id>
            <phase>test</phase>
            <goals>
              <goal>report</goal>
            </goals>
          </execution>
        </executions>
      </plugin>`;

        // Add dependencies before </dependencies>
        let updatedPom = pomContent.replace('</dependencies>', `${testDependencies}\n  </dependencies>`);
        
        // Add JaCoCo plugin before </plugins>
        if (updatedPom.includes('<plugins>')) {
          updatedPom = updatedPom.replace('</plugins>', `${jaccocoPlugin}\n    </plugins>`);
        }

        await fs.writeFile(pomPath, updatedPom);
        console.log('✅ Test dependencies added to pom.xml');
      }
    } catch (error) {
      console.warn('⚠️ Could not update pom.xml, dependencies may need manual configuration');
    }
  }

  /**
   * Execute tests using Maven
   */
  private async executeTests(repoPath: string): Promise<TestMetrics> {
    console.log('🏃 Executing tests...');
    
    try {
      const command = process.platform === 'win32' ? 'mvnw.cmd test' : './mvnw test';
      const output = execSync(command, { 
        cwd: repoPath, 
        encoding: 'utf8',
        timeout: 300000 // 5 minutes timeout
      });

      return this.parseTestOutput(output);
    } catch (error: any) {
      console.error('❌ Test execution failed:', error.message);
      
      // Try to parse partial results from error output
      if (error.stdout) {
        return this.parseTestOutput(error.stdout);
      }
      
      return this.getDefaultMetrics();
    }
  }

  /**
   * Parse Maven test output to extract metrics
   */
  private parseTestOutput(output: string): TestMetrics {
    const metrics: TestMetrics = {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      executionTime: 0,
      coverage: {
        linePercentage: 0,
        branchPercentage: 0,
        methodPercentage: 0
      }
    };

    // Parse test results
    const testResultMatch = output.match(/Tests run: (\d+), Failures: (\d+), Errors: (\d+), Skipped: (\d+)/);
    if (testResultMatch) {
      metrics.totalTests = parseInt(testResultMatch[1]);
      const failures = parseInt(testResultMatch[2]);
      const errors = parseInt(testResultMatch[3]);
      metrics.failedTests = failures + errors;
      metrics.skippedTests = parseInt(testResultMatch[4]);
      metrics.passedTests = metrics.totalTests - metrics.failedTests - metrics.skippedTests;
    }

    // Parse execution time
    const timeMatch = output.match(/Total time:\s+(\d+\.?\d*)\s*s/);
    if (timeMatch) {
      metrics.executionTime = parseFloat(timeMatch[1]);
    }

    return metrics;
  }

  /**
   * Generate coverage report using JaCoCo
   */
  private async generateCoverageReport(repoPath: string): Promise<string> {
    console.log('📊 Generating coverage report...');
    
    try {
      const command = process.platform === 'win32' ? 'mvnw.cmd jacoco:report' : './mvnw jacoco:report';
      execSync(command, { cwd: repoPath, timeout: 120000 });

      const reportPath = path.join(repoPath, 'target', 'site', 'jacoco', 'index.html');
      if (await this.fileExists(reportPath)) {
        return `Coverage report generated at: ${reportPath}`;
      }
    } catch (error) {
      console.warn('⚠️ Coverage report generation failed');
    }

    return 'Coverage report not available';
  }

  /**
   * Helper methods
   */
  private extractClassName(filePath: string): string {
    const fileName = path.basename(filePath, '.java');
    return fileName;
  }

  private extractPackageName(filePath: string): string {
    const javaIndex = filePath.indexOf('java' + path.sep);
    if (javaIndex === -1) return 'com.example.demo';
    
    const packagePath = filePath.substring(javaIndex + 5).replace(path.sep + path.basename(filePath), '');
    return packagePath.replace(/[\\/]/g, '.');
  }

  private async writeTestFile(testSourcePath: string, packagePath: string, fileName: string, content: string): Promise<string | null> {
    try {
      const fullPath = path.join(testSourcePath, packagePath);
      await fs.mkdir(fullPath, { recursive: true });
      
      const filePath = path.join(fullPath, fileName);
      await fs.writeFile(filePath, content);
      
      console.log(`✅ Test file created: ${fileName}`);
      return filePath;
    } catch (error) {
      console.error(`❌ Failed to create test file ${fileName}:`, error);
      return null;
    }
  }

  private cleanupGeneratedCode(code: string): string {
    // Remove markdown code blocks if present
    return code.replace(/```java\n?/g, '').replace(/```\n?/g, '').trim();
  }

  private formatTestReport(metrics: TestMetrics): string {
    const successRate = metrics.totalTests > 0 ? 
      ((metrics.passedTests / metrics.totalTests) * 100).toFixed(1) : '0';

    return `
Test Execution Report:
=====================
Total Tests: ${metrics.totalTests}
Passed: ${metrics.passedTests}
Failed: ${metrics.failedTests}
Skipped: ${metrics.skippedTests}
Success Rate: ${successRate}%
Execution Time: ${metrics.executionTime}s

Coverage Summary:
- Line Coverage: ${metrics.coverage.linePercentage}%
- Branch Coverage: ${metrics.coverage.branchPercentage}%
- Method Coverage: ${metrics.coverage.methodPercentage}%
`;
  }

  private getDefaultMetrics(): TestMetrics {
    return {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      executionTime: 0,
      coverage: {
        linePercentage: 0,
        branchPercentage: 0,
        methodPercentage: 0
      }
    };
  }

  /**
   * Helper method to predict implemented files for testing
   */
  private predictImplementedFiles(issueData: any): string[] {
    const baseDir = `./workspace/${issueData.owner}-${issueData.repo}/src/main/java/com/example/employee`;
    
    // Extract entity name from issue title or body
    const entityMatch = issueData.title.match(/(\w+)\s+(entity|model|class)/i) || 
                       issueData.body?.match(/(\w+)\s+(entity|model|class)/i);
    
    if (entityMatch) {
      const entityName = entityMatch[1];
      return [
        `${baseDir}/model/${entityName}.java`,
        `${baseDir}/repository/${entityName}Repository.java`,
        `${baseDir}/service/${entityName}Service.java`,
        `${baseDir}/controller/${entityName}Controller.java`
      ];
    }
    
    // Default prediction
    return [
      `${baseDir}/model/Vehicle.java`,
      `${baseDir}/repository/VehicleRepository.java`,
      `${baseDir}/service/VehicleService.java`,
      `${baseDir}/controller/VehicleController.java`
    ];
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
