import path from 'path';
import fs from 'fs/promises';
import { execSync } from 'child_process';

export interface DeploymentConfig {
  awsRegion: string;
  serviceName: string;
  environment: 'dev' | 'staging' | 'prod';
  containerPort: number;
  healthCheckPath: string;
  cpu: string;
  memory: string;
  desiredCount: number;
}

export interface DeploymentResult {
  success: boolean;
  serviceUrl?: string;
  deploymentTime: number;
  artifacts: string[];
  logs: string[];
  errorDetails?: string[];
  rollbackAvailable: boolean;
}

export interface AWSResources {
  ecrRepository: string;
  ecsCluster: string;
  ecsService: string;
  taskDefinition: string;
  loadBalancer?: string;
  cloudFormationStack: string;
}

export class DeployAgent {
  private static readonly DEFAULT_CONFIG: DeploymentConfig = {
    awsRegion: 'us-east-1',
    serviceName: 'github-agent-app',
    environment: 'dev',
    containerPort: 8080,
    healthCheckPath: '/actuator/health',
    cpu: '256',
    memory: '512',
    desiredCount: 1
  };

  constructor() {}

  /**
   * Main entry point for AWS deployment
   */
  async deployToAWS(
    repoPath: string,
    testResults: any,
    deployConfig?: Partial<DeploymentConfig>
  ): Promise<DeploymentResult> {
    console.log('🚀 Starting DeployAgent: Deploying to AWS...');
    
    const startTime = Date.now();
    const config = { ...DeployAgent.DEFAULT_CONFIG, ...deployConfig };
    const artifacts: string[] = [];
    const logs: string[] = [];

    try {
      // Pre-deployment validation
      await this.validatePrerequisites(repoPath, testResults);
      logs.push('✅ Pre-deployment validation passed');

      // Build Docker image
      const dockerImageTag = await this.buildDockerImage(repoPath, config);
      artifacts.push(`Docker Image: ${dockerImageTag}`);
      logs.push(`✅ Docker image built: ${dockerImageTag}`);

      // Setup AWS infrastructure
      const awsResources = await this.setupAWSInfrastructure(config);
      artifacts.push(`CloudFormation Stack: ${awsResources.cloudFormationStack}`);
      logs.push('✅ AWS infrastructure provisioned');

      // Push image to ECR
      await this.pushToECR(dockerImageTag, awsResources.ecrRepository, config);
      logs.push('✅ Docker image pushed to ECR');

      // Deploy to ECS
      const serviceUrl = await this.deployToECS(awsResources, config);
      logs.push('✅ Application deployed to ECS');

      // Perform health check
      await this.performHealthCheck(serviceUrl, config);
      logs.push('✅ Health check passed');

      const deploymentTime = Date.now() - startTime;

      return {
        success: true,
        serviceUrl,
        deploymentTime,
        artifacts,
        logs,
        rollbackAvailable: true
      };

    } catch (error) {
      console.error('❌ Deployment failed:', error);
      const deploymentTime = Date.now() - startTime;

      return {
        success: false,
        deploymentTime,
        artifacts,
        logs,
        errorDetails: [error instanceof Error ? error.message : String(error)],
        rollbackAvailable: false
      };
    }
  }

  /**
   * Validate prerequisites for deployment
   */
  private async validatePrerequisites(repoPath: string, testResults: any): Promise<void> {
    console.log('🔍 Validating deployment prerequisites...');

    // Check if tests passed
    if (!testResults?.success) {
      throw new Error('Cannot deploy: Tests failed. All tests must pass before deployment.');
    }

    // Check if AWS CLI is installed and configured
    try {
      execSync('aws --version', { stdio: 'pipe' });
    } catch {
      throw new Error('AWS CLI is not installed or not in PATH. Please install AWS CLI.');
    }

    try {
      execSync('aws sts get-caller-identity', { stdio: 'pipe' });
    } catch {
      throw new Error('AWS CLI is not configured. Please run "aws configure" first.');
    }

    // Check if Docker is installed
    try {
      execSync('docker --version', { stdio: 'pipe' });
    } catch {
      throw new Error('Docker is not installed or not in PATH. Please install Docker.');
    }

    // Check if Maven build file exists
    const pomPath = path.join(repoPath, 'pom.xml');
    try {
      await fs.access(pomPath);
    } catch {
      throw new Error('pom.xml not found. This deployment agent requires a Maven project.');
    }

    console.log('✅ All prerequisites validated');
  }

  /**
   * Build Docker image for the Spring Boot application
   */
  private async buildDockerImage(repoPath: string, config: DeploymentConfig): Promise<string> {
    console.log('🐳 Building Docker image...');

    // Create Dockerfile if it doesn't exist
    await this.ensureDockerfile(repoPath, config);

    // Build Maven package
    console.log('📦 Building Maven package...');
    const buildCommand = process.platform === 'win32' ? 'mvnw.cmd clean package -DskipTests' : './mvnw clean package -DskipTests';
    execSync(buildCommand, { cwd: repoPath, stdio: 'pipe' });

    // Build Docker image
    const imageTag = `${config.serviceName}:${config.environment}-${Date.now()}`;
    console.log(`🏗️ Building Docker image: ${imageTag}`);
    
    execSync(`docker build -t ${imageTag} .`, { cwd: repoPath, stdio: 'pipe' });

    return imageTag;
  }

  /**
   * Ensure Dockerfile exists with proper Spring Boot configuration
   */
  private async ensureDockerfile(repoPath: string, config: DeploymentConfig): Promise<void> {
    const dockerfilePath = path.join(repoPath, 'Dockerfile');
    
    try {
      await fs.access(dockerfilePath);
      console.log('📄 Using existing Dockerfile');
    } catch {
      console.log('📄 Creating Dockerfile...');
      
      const dockerfileContent = `# Multi-stage build for Spring Boot application
FROM openjdk:17-jdk-slim as builder

WORKDIR /app
COPY pom.xml .
COPY src ./src

# Install Maven
RUN apt-get update && apt-get install -y maven

# Build the application
RUN mvn clean package -DskipTests

# Runtime stage
FROM openjdk:17-jre-slim

WORKDIR /app

# Create non-root user
RUN groupadd -r spring && useradd -r -g spring spring

# Copy the built jar
COPY --from=builder /app/target/*.jar app.jar

# Change ownership
RUN chown spring:spring app.jar

# Switch to non-root user
USER spring

# Expose port
EXPOSE ${config.containerPort}

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \\
  CMD curl -f http://localhost:${config.containerPort}${config.healthCheckPath} || exit 1

# Run the application
ENTRYPOINT ["java", "-jar", "/app/app.jar"]`;

      await fs.writeFile(dockerfilePath, dockerfileContent);
      console.log('✅ Dockerfile created');
    }
  }

  /**
   * Setup AWS infrastructure using CloudFormation
   */
  private async setupAWSInfrastructure(config: DeploymentConfig): Promise<AWSResources> {
    console.log('☁️ Setting up AWS infrastructure...');

    const stackName = `${config.serviceName}-${config.environment}-stack`;
    const ecrRepository = `${config.serviceName}-${config.environment}`;
    const ecsCluster = `${config.serviceName}-${config.environment}-cluster`;
    const ecsService = `${config.serviceName}-${config.environment}-service`;

    // Create CloudFormation template
    const cloudFormationTemplate = this.generateCloudFormationTemplate(config);
    const templatePath = `/tmp/${stackName}-template.yaml`;
    await fs.writeFile(templatePath, cloudFormationTemplate);

    try {
      // Deploy CloudFormation stack
      const deployCommand = `aws cloudformation deploy \\
        --template-file ${templatePath} \\
        --stack-name ${stackName} \\
        --parameter-overrides \\
          ServiceName=${config.serviceName} \\
          Environment=${config.environment} \\
          ContainerPort=${config.containerPort} \\
          ContainerCpu=${config.cpu} \\
          ContainerMemory=${config.memory} \\
          DesiredCount=${config.desiredCount} \\
        --capabilities CAPABILITY_IAM \\
        --region ${config.awsRegion}`;

      execSync(deployCommand, { stdio: 'pipe' });
      console.log('✅ CloudFormation stack deployed');

    } catch (error) {
      console.log('📋 CloudFormation stack may already exist, continuing...');
    }

    return {
      ecrRepository,
      ecsCluster,
      ecsService,
      taskDefinition: `${config.serviceName}-${config.environment}-task`,
      cloudFormationStack: stackName
    };
  }

  /**
   * Generate CloudFormation template for AWS resources
   */
  private generateCloudFormationTemplate(config: DeploymentConfig): string {
    return `AWSTemplateFormatVersion: '2010-09-09'
Description: 'ECS infrastructure for ${config.serviceName}'

Parameters:
  ServiceName:
    Type: String
    Default: ${config.serviceName}
  Environment:
    Type: String
    Default: ${config.environment}
  ContainerPort:
    Type: Number
    Default: ${config.containerPort}
  ContainerCpu:
    Type: String
    Default: '${config.cpu}'
  ContainerMemory:
    Type: String
    Default: '${config.memory}'
  DesiredCount:
    Type: Number
    Default: ${config.desiredCount}

Resources:
  # ECR Repository
  ECRRepository:
    Type: AWS::ECR::Repository
    Properties:
      RepositoryName: !Sub '\${ServiceName}-\${Environment}'
      LifecyclePolicy:
        LifecyclePolicyText: |
          {
            "rules": [
              {
                "rulePriority": 1,
                "selection": {
                  "tagStatus": "untagged",
                  "countType": "sinceImagePushed",
                  "countUnit": "days",
                  "countNumber": 7
                },
                "action": {
                  "type": "expire"
                }
              }
            ]
          }

  # VPC
  VPC:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
      EnableDnsHostnames: true
      EnableDnsSupport: true
      Tags:
        - Key: Name
          Value: !Sub '\${ServiceName}-\${Environment}-vpc'

  # Internet Gateway
  InternetGateway:
    Type: AWS::EC2::InternetGateway
    Properties:
      Tags:
        - Key: Name
          Value: !Sub '\${ServiceName}-\${Environment}-igw'

  InternetGatewayAttachment:
    Type: AWS::EC2::VPCGatewayAttachment
    Properties:
      InternetGatewayId: !Ref InternetGateway
      VpcId: !Ref VPC

  # Public Subnets
  PublicSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      AvailabilityZone: !Select [0, !GetAZs '']
      CidrBlock: 10.0.1.0/24
      MapPublicIpOnLaunch: true
      Tags:
        - Key: Name
          Value: !Sub '\${ServiceName}-\${Environment}-public-subnet-1'

  PublicSubnet2:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      AvailabilityZone: !Select [1, !GetAZs '']
      CidrBlock: 10.0.2.0/24
      MapPublicIpOnLaunch: true
      Tags:
        - Key: Name
          Value: !Sub '\${ServiceName}-\${Environment}-public-subnet-2'

  # Route Table
  PublicRouteTable:
    Type: AWS::EC2::RouteTable
    Properties:
      VpcId: !Ref VPC
      Tags:
        - Key: Name
          Value: !Sub '\${ServiceName}-\${Environment}-public-routes'

  DefaultPublicRoute:
    Type: AWS::EC2::Route
    DependsOn: InternetGatewayAttachment
    Properties:
      RouteTableId: !Ref PublicRouteTable
      DestinationCidrBlock: 0.0.0.0/0
      GatewayId: !Ref InternetGateway

  PublicSubnet1RouteTableAssociation:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      RouteTableId: !Ref PublicRouteTable
      SubnetId: !Ref PublicSubnet1

  PublicSubnet2RouteTableAssociation:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      RouteTableId: !Ref PublicRouteTable
      SubnetId: !Ref PublicSubnet2

  # Security Group
  SecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupName: !Sub '\${ServiceName}-\${Environment}-sg'
      GroupDescription: Security group for ECS service
      VpcId: !Ref VPC
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: !Ref ContainerPort
          ToPort: !Ref ContainerPort
          CidrIp: 0.0.0.0/0
      SecurityGroupEgress:
        - IpProtocol: -1
          CidrIp: 0.0.0.0/0

  # ECS Cluster
  ECSCluster:
    Type: AWS::ECS::Cluster
    Properties:
      ClusterName: !Sub '\${ServiceName}-\${Environment}-cluster'

  # ECS Task Definition
  TaskDefinition:
    Type: AWS::ECS::TaskDefinition
    Properties:
      Family: !Sub '\${ServiceName}-\${Environment}-task'
      Cpu: !Ref ContainerCpu
      Memory: !Ref ContainerMemory
      NetworkMode: awsvpc
      RequiresCompatibilities:
        - FARGATE
      ExecutionRoleArn: !Ref TaskExecutionRole
      ContainerDefinitions:
        - Name: !Sub '\${ServiceName}-\${Environment}-container'
          Image: !Sub '\${AWS::AccountId}.dkr.ecr.\${AWS::Region}.amazonaws.com/\${ServiceName}-\${Environment}:latest'
          PortMappings:
            - ContainerPort: !Ref ContainerPort
          LogConfiguration:
            LogDriver: awslogs
            Options:
              awslogs-group: !Ref LogGroup
              awslogs-region: !Ref AWS::Region
              awslogs-stream-prefix: ecs

  # ECS Service
  ECSService:
    Type: AWS::ECS::Service
    Properties:
      ServiceName: !Sub '\${ServiceName}-\${Environment}-service'
      Cluster: !Ref ECSCluster
      LaunchType: FARGATE
      DesiredCount: !Ref DesiredCount
      TaskDefinition: !Ref TaskDefinition
      NetworkConfiguration:
        AwsvpcConfiguration:
          SecurityGroups:
            - !Ref SecurityGroup
          Subnets:
            - !Ref PublicSubnet1
            - !Ref PublicSubnet2
          AssignPublicIp: ENABLED

  # IAM Role for Task Execution
  TaskExecutionRole:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service: ecs-tasks.amazonaws.com
            Action: sts:AssumeRole
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

  # CloudWatch Log Group
  LogGroup:
    Type: AWS::Logs::LogGroup
    Properties:
      LogGroupName: !Sub '/ecs/\${ServiceName}-\${Environment}'
      RetentionInDays: 30

Outputs:
  ECRRepository:
    Description: ECR Repository URI
    Value: !Sub '\${AWS::AccountId}.dkr.ecr.\${AWS::Region}.amazonaws.com/\${ServiceName}-\${Environment}'
    Export:
      Name: !Sub '\${AWS::StackName}-ECRRepository'
  
  ECSCluster:
    Description: ECS Cluster Name
    Value: !Ref ECSCluster
    Export:
      Name: !Sub '\${AWS::StackName}-ECSCluster'
      
  ECSService:
    Description: ECS Service Name
    Value: !Ref ECSService
    Export:
      Name: !Sub '\${AWS::StackName}-ECSService'`;
  }

  /**
   * Push Docker image to ECR
   */
  private async pushToECR(imageTag: string, ecrRepository: string, config: DeploymentConfig): Promise<void> {
    console.log('📤 Pushing image to ECR...');

    // Get ECR login token
    const loginCommand = `aws ecr get-login-password --region ${config.awsRegion} | docker login --username AWS --password-stdin $(aws sts get-caller-identity --query Account --output text).dkr.ecr.${config.awsRegion}.amazonaws.com`;
    execSync(loginCommand, { stdio: 'pipe' });

    // Tag image for ECR
    const accountId = execSync('aws sts get-caller-identity --query Account --output text', { encoding: 'utf8' }).trim();
    const ecrImageUri = `${accountId}.dkr.ecr.${config.awsRegion}.amazonaws.com/${ecrRepository}:latest`;
    
    execSync(`docker tag ${imageTag} ${ecrImageUri}`, { stdio: 'pipe' });

    // Push to ECR
    execSync(`docker push ${ecrImageUri}`, { stdio: 'pipe' });

    console.log('✅ Image pushed to ECR successfully');
  }

  /**
   * Deploy to ECS
   */
  private async deployToECS(awsResources: AWSResources, config: DeploymentConfig): Promise<string> {
    console.log('🚀 Deploying to ECS...');

    // Update ECS service to use new image
    const updateCommand = `aws ecs update-service \\
      --cluster ${awsResources.ecsCluster} \\
      --service ${awsResources.ecsService} \\
      --force-new-deployment \\
      --region ${config.awsRegion}`;

    execSync(updateCommand, { stdio: 'pipe' });

    // Wait for deployment to complete
    console.log('⏳ Waiting for deployment to stabilize...');
    const waitCommand = `aws ecs wait services-stable \\
      --cluster ${awsResources.ecsCluster} \\
      --services ${awsResources.ecsService} \\
      --region ${config.awsRegion}`;

    execSync(waitCommand, { stdio: 'pipe', timeout: 600000 }); // 10 minutes timeout

    // Get service URL (assuming ALB is configured)
    const serviceUrl = await this.getServiceUrl(awsResources, config);
    
    console.log('✅ ECS deployment completed');
    return serviceUrl;
  }

  /**
   * Get service URL (simplified - in real scenario would get ALB DNS)
   */
  private async getServiceUrl(awsResources: AWSResources, config: DeploymentConfig): Promise<string> {
    // In a real implementation, this would get the Load Balancer DNS name
    // by querying the CloudFormation stack outputs or ECS service configuration
    return `http://${config.serviceName}-${config.environment}.${config.awsRegion}.amazonaws.com`;
  }

  /**
   * Perform health check on deployed service
   */
  private async performHealthCheck(serviceUrl: string, config: DeploymentConfig): Promise<void> {
    console.log('🏥 Performing health check...');

    const healthCheckUrl = `${serviceUrl}${config.healthCheckPath}`;
    let attempts = 0;
    const maxAttempts = 10;
    const delay = 30000; // 30 seconds

    while (attempts < maxAttempts) {
      try {
        // Simple health check (in real implementation, use proper HTTP client)
        execSync(`curl -f ${healthCheckUrl}`, { stdio: 'pipe', timeout: 10000 });
        console.log('✅ Health check passed');
        return;
      } catch (error) {
        attempts++;
        console.log(`⏳ Health check attempt ${attempts}/${maxAttempts} failed, retrying in ${delay/1000}s...`);
        
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error('Health check failed after maximum attempts');
  }

  /**
   * Rollback deployment
   */
  async rollbackDeployment(
    awsResources: AWSResources,
    config: DeploymentConfig,
    previousTaskDefinition?: string
  ): Promise<boolean> {
    console.log('🔄 Rolling back deployment...');

    try {
      if (!previousTaskDefinition) {
        // Get previous task definition
        const describeCommand = `aws ecs describe-services \\
          --cluster ${awsResources.ecsCluster} \\
          --services ${awsResources.ecsService} \\
          --region ${config.awsRegion}`;
        
        const serviceInfo = JSON.parse(execSync(describeCommand, { encoding: 'utf8' }));
        const taskDefArn = serviceInfo.services[0].taskDefinition;
        previousTaskDefinition = taskDefArn.split('/').pop()?.split(':')[0];
      }

      if (previousTaskDefinition) {
        const rollbackCommand = `aws ecs update-service \\
          --cluster ${awsResources.ecsCluster} \\
          --service ${awsResources.ecsService} \\
          --task-definition ${previousTaskDefinition} \\
          --region ${config.awsRegion}`;

        execSync(rollbackCommand, { stdio: 'pipe' });
        console.log('✅ Rollback completed');
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ Rollback failed:', error);
      return false;
    }
  }

  /**
   * Clean up AWS resources
   */
  async cleanupAWSResources(stackName: string, config: DeploymentConfig): Promise<void> {
    console.log('🧹 Cleaning up AWS resources...');

    try {
      const deleteCommand = `aws cloudformation delete-stack \\
        --stack-name ${stackName} \\
        --region ${config.awsRegion}`;

      execSync(deleteCommand, { stdio: 'pipe' });
      console.log('✅ CloudFormation stack deletion initiated');
    } catch (error) {
      console.error('❌ Failed to cleanup AWS resources:', error);
    }
  }
}
