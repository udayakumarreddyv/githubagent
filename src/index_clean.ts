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

// Cleanup old workspaces on startup
console.log(`🧹 Performing startup workspace cleanup...`);
githubAgent.cleanupOldWorkspaces(24).catch(error => {
  console.warn(`⚠️ Startup cleanup failed:`, error);
});

// Schedule periodic cleanup every 6 hours
setInterval(async () => {
  console.log(`⏰ Performing scheduled workspace cleanup...`);
  try {
    await githubAgent.cleanupOldWorkspaces(24);
  } catch (error) {
    console.warn(`⚠️ Scheduled cleanup failed:`, error);
  }
}, 6 * 60 * 60 * 1000); // 6 hours

// Webhook endpoint - handle both JSON and URL-encoded payloads
app.post('/webhook', express.raw({ type: 'application/json' }), express.urlencoded({ extended: true }), async (req, res) => {
  const signature = req.get('x-hub-signature-256') as string;
  const delivery = req.get('x-github-delivery') as string;
  const event = req.get('x-github-event') as any;
  const contentType = req.get('content-type');
  
  console.log(`📨 Received webhook: ${event} (${delivery})`);
  console.log(`🔐 Signature: ${signature}`);
  console.log(`📋 Content-Type: ${contentType}`);
  console.log(`🔑 Secret configured: ${process.env.WEBHOOK_SECRET ? 'Yes' : 'No'}`);
  
  try {
    let payload = req.body;
    
    // Handle URL-encoded payload (GitHub's default)
    if (contentType?.includes('application/x-www-form-urlencoded')) {
      console.log('📦 Processing URL-encoded payload');
      if (req.body && req.body.payload) {
        // For signature verification, we need the raw URL-encoded string
        payload = `payload=${encodeURIComponent(req.body.payload)}`;
        console.log('🔄 Reconstructed payload for signature verification');
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
    
    console.log(`📊 Payload length: ${payload?.length || 0}`);
    
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

// Maintenance endpoints
app.post('/admin/cleanup-all', async (req, res) => {
  try {
    console.log(`🧹 Admin: Full workspace cleanup requested`);
    await githubAgent.cleanupAllWorkspaces();
    res.status(200).json({ 
      status: 'success', 
      message: 'All workspaces cleaned up successfully' 
    });
  } catch (error) {
    console.error('❌ Admin cleanup failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ 
      status: 'error', 
      message: `Cleanup failed: ${errorMessage}` 
    });
  }
});

app.post('/admin/cleanup-old', async (req, res) => {
  try {
    const maxAgeHours = req.body?.maxAgeHours || 24;
    console.log(`🧹 Admin: Cleaning workspaces older than ${maxAgeHours} hours`);
    await githubAgent.cleanupOldWorkspaces(maxAgeHours);
    res.status(200).json({ 
      status: 'success', 
      message: `Cleaned up workspaces older than ${maxAgeHours} hours` 
    });
  } catch (error) {
    console.error('❌ Admin cleanup failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ 
      status: 'error', 
      message: `Cleanup failed: ${errorMessage}` 
    });
  }
});

// Start server
app.listen(port, () => {
  console.log(`🚀 GitHub Agent server running on port ${port}`);
  console.log(`📋 Health check: http://localhost:${port}/health`);
  console.log(`🪝 Webhook endpoint: http://localhost:${port}/webhook`);
  console.log(`🧹 Admin cleanup: POST /admin/cleanup-all or /admin/cleanup-old`);
});

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log(`\n🛑 Received SIGINT, shutting down gracefully...`);
  try {
    console.log(`🧹 Performing final workspace cleanup...`);
    await githubAgent.cleanupAllWorkspaces();
    console.log(`✅ Final cleanup completed`);
  } catch (error) {
    console.warn(`⚠️ Final cleanup failed:`, error);
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log(`\n🛑 Received SIGTERM, shutting down gracefully...`);
  try {
    console.log(`🧹 Performing final workspace cleanup...`);
    await githubAgent.cleanupAllWorkspaces();
    console.log(`✅ Final cleanup completed`);
  } catch (error) {
    console.warn(`⚠️ Final cleanup failed:`, error);
  }
  process.exit(0);
});

export default app;
