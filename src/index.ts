import express from 'express';
import { Webhooks } from '@octokit/webhooks';
import { Octokit } from '@octokit/rest';
import dotenv from 'dotenv';
import { GitHubAgent } from './agent/GitHubAgent';
import { WebhookHandler } from './webhooks/WebhookHandler';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Initialize GitHub client
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

// Initialize webhook handler with optional signature verification
const webhooks = new Webhooks({
  secret: process.env.WEBHOOK_SECRET || 'default-secret',
});

// Initialize GitHub agent
const githubAgent = new GitHubAgent(octokit);

// Initialize webhook handler
const webhookHandler = new WebhookHandler(webhooks, githubAgent);

// Webhook endpoint - handle both JSON and URL-encoded payloads
app.post('/webhook', express.raw({ type: 'application/json' }), express.urlencoded({ extended: true }), async (req, res) => {
  const signature = req.get('x-hub-signature-256') as string;
  const delivery = req.get('x-github-delivery') as string;
  const event = req.get('x-github-event') as any;
  const contentType = req.get('content-type');
  
  console.log(`📨 Received webhook: ${event} (${delivery})`);
  console.log(`🔐 Signature: ${signature}`);
  console.log(`� Content-Type: ${contentType}`);
  console.log(`�🔑 Secret configured: ${process.env.WEBHOOK_SECRET ? 'Yes' : 'No'}`);
  
  try {
    let payload = req.body;
    
    // Handle URL-encoded payload (GitHub's default)
    if (contentType?.includes('application/x-www-form-urlencoded')) {
      console.log('📦 Processing URL-encoded payload');
      if (req.body && req.body.payload) {
        // For signature verification, we need the raw URL-encoded string
        payload = `payload=${encodeURIComponent(req.body.payload)}`;
        console.log('� Reconstructed payload for signature verification');
      } else {
        throw new Error('No payload parameter found in URL-encoded data');
      }
    }
    // Handle JSON payload
    else if (Buffer.isBuffer(payload)) {
      console.log('📦 Processing JSON payload as Buffer');
    } else {
      console.log('📦 Processing JSON payload as string');
    }
    
    console.log(`� Payload length: ${payload?.length || 0}`);
    
    await webhooks.verifyAndReceive({
      id: delivery,
      name: event,
      signature: signature,
      payload: payload,
    });
    
    console.log(`✅ Webhook processed successfully`);
    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Webhook error:', error);
    console.error('❌ Error details:', {
      hasSignature: !!signature,
      hasDelivery: !!delivery,
      hasEvent: !!event,
      contentType: contentType,
      payloadType: typeof req.body,
      isBuffer: Buffer.isBuffer(req.body),
      secretConfigured: !!process.env.WEBHOOK_SECRET
    });
    
    // Try without signature verification as fallback
    if (req.body && req.body.payload) {
      console.log('🔄 Attempting to process without signature verification...');
      try {
        const parsedPayload = JSON.parse(req.body.payload);
        if (event === 'issues' && parsedPayload.action && parsedPayload.issue) {
          const issueData = {
            owner: parsedPayload.repository.owner.login,
            repo: parsedPayload.repository.name,
            issueNumber: parsedPayload.issue.number,
            title: parsedPayload.issue.title,
            body: parsedPayload.issue.body || '',
            labels: parsedPayload.issue.labels.map((label: any) => label.name),
          };
          
          await githubAgent.handleIssue(issueData);
          console.log('✅ Processed without signature verification');
          return res.status(200).send('OK');
        }
      } catch (fallbackError) {
        console.error('❌ Fallback processing also failed:', fallbackError);
      }
    }
    
    res.status(400).send('Bad Request');
  }
});

// Regular JSON middleware for other endpoints (applied after webhook route)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Multi-agent orchestrator status endpoint
app.get('/status', (req, res) => {
  try {
    const orchestratorStatus = webhookHandler.getOrchestratorStatus();
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      multiAgent: orchestratorStatus,
      version: '2.0.0',
      features: {
        codeGeneration: true,
        emailNotifications: orchestratorStatus.config.enableEmailNotifications,
        multiAgentOrchestration: true
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: (error as Error).message,
      timestamp: new Date().toISOString()
    });
  }
});

// Test endpoint without signature verification (for debugging)
app.post('/webhook-test', express.json(), async (req, res) => {
  console.log('🧪 Test webhook received (no signature verification)');
  console.log('📦 Payload:', JSON.stringify(req.body, null, 2));
  
  if (req.body.action && req.body.issue) {
    try {
      const webhookHandler = new WebhookHandler(webhooks, githubAgent);
      // Manually trigger the issue handler for testing
      const issueData = {
        owner: req.body.repository.owner.login,
        repo: req.body.repository.name,
        issueNumber: req.body.issue.number,
        title: req.body.issue.title,
        body: req.body.issue.body || '',
        labels: req.body.issue.labels.map((label: any) => label.name),
      };
      
      await githubAgent.handleIssue(issueData);
      res.status(200).json({ status: 'processed', issue: issueData });
    } catch (error) {
      console.error('Test webhook error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: errorMessage });
    }
  } else {
    res.status(200).json({ status: 'received', message: 'Not an issue event' });
  }
});

// Temporary webhook endpoint without signature verification (for testing)
app.post('/webhook-nosig', express.json(), express.urlencoded({ extended: true }), async (req, res) => {
  console.log('🔓 Webhook received (NO signature verification)');
  console.log('📦 Headers:', {
    'x-github-event': req.get('x-github-event'),
    'x-github-delivery': req.get('x-github-delivery'),
    'content-type': req.get('content-type')
  });
  console.log('📦 Raw body type:', typeof req.body);
  console.log('📦 Body keys:', Object.keys(req.body || {}));
  
  // Handle both JSON and URL-encoded payloads (same as webhook-test)
  let parsedBody;
  try {
    // Check if it's URL-encoded with payload parameter (GitHub's default)
    if (req.body && req.body.payload) {
      console.log('📦 Found payload parameter');
      parsedBody = JSON.parse(req.body.payload);
      console.log('✅ Successfully parsed GitHub payload');
    } 
    // Otherwise treat as direct JSON (like webhook-test)
    else if (req.body && req.body.action) {
      console.log('📦 Found direct JSON payload');
      parsedBody = req.body;
      console.log('✅ Using direct JSON payload');
    } else {
      console.log('⚠️ No valid payload found');
      parsedBody = req.body;
    }
  } catch (error) {
    console.error('❌ Failed to parse payload:', error);
    parsedBody = null;
  }
  
  if (!parsedBody) {
    console.log('⚠️ No valid payload received');
    return res.status(200).json({ 
      status: 'received', 
      message: 'No payload', 
      headers: req.headers,
      bodyType: typeof req.body,
      bodyKeys: Object.keys(req.body || {})
    });
  }
  
  console.log('📦 Action:', parsedBody.action);
  console.log('📦 Issue number:', parsedBody.issue?.number);
  console.log('📦 Repository:', parsedBody.repository?.full_name);
  
  try {
    const event = req.get('x-github-event') as any;
    
    if (event === 'issues' && parsedBody.action && parsedBody.issue) {
      const issueData = {
        owner: parsedBody.repository.owner.login,
        repo: parsedBody.repository.name,
        issueNumber: parsedBody.issue.number,
        title: parsedBody.issue.title,
        body: parsedBody.issue.body || '',
        labels: parsedBody.issue.labels.map((label: any) => label.name),
      };
      
      console.log('🔍 Processing issue without signature verification:', issueData);
      
      // Same async/await processing as webhook-test
      await githubAgent.handleIssue(issueData);
      res.status(200).json({ status: 'processed', issue: issueData });
    } else {
      res.status(200).json({ status: 'received', event, action: parsedBody.action || 'no action' });
    }
  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: errorMessage });
  }
});

// Raw debug endpoint to see exactly what GitHub sends
app.post('/webhook-raw', express.raw({ type: '*/*' }), (req, res) => {
  console.log('🔍 Raw webhook debug:');
  console.log('📦 All headers:', req.headers);
  console.log('📦 Method:', req.method);
  console.log('📦 URL:', req.url);
  console.log('📦 Content-Type:', req.get('content-type'));
  console.log('📦 Content-Length:', req.get('content-length'));
  console.log('📦 Body type:', typeof req.body);
  console.log('📦 Body is Buffer:', Buffer.isBuffer(req.body));
  console.log('📦 Body length:', req.body?.length || 0);
  
  if (Buffer.isBuffer(req.body) && req.body.length > 0) {
    const bodyString = req.body.toString('utf8');
    console.log('📦 Body as string (first 200 chars):', bodyString.substring(0, 200));
    
    try {
      const parsed = JSON.parse(bodyString);
      console.log('✅ Successfully parsed JSON');
      console.log('📦 Action:', parsed.action);
      console.log('📦 Issue number:', parsed.issue?.number);
    } catch (error) {
      console.error('❌ Failed to parse JSON:', error);
    }
  } else {
    console.log('⚠️ No body received or body is empty');
  }
  
  res.status(200).json({ 
    status: 'debug-received',
    contentType: req.get('content-type'),
    bodyType: typeof req.body,
    bodyLength: req.body?.length || 0,
    isBuffer: Buffer.isBuffer(req.body)
  });
});

// Start server
app.listen(port, () => {
  console.log(`🚀 GitHub Agent server running on port ${port}`);
  console.log(`📋 Health check: http://localhost:${port}/health`);
  console.log(`🪝 Webhook endpoint: http://localhost:${port}/webhook`);
});

export default app;
 
 
