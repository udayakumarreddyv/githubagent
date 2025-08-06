import { Webhooks } from '@octokit/webhooks';
import { GitHubAgent, IssueData } from '../agent/GitHubAgent';

export class WebhookHandler {
  private webhooks: Webhooks;
  private githubAgent: GitHubAgent;

  constructor(webhooks: Webhooks, githubAgent: GitHubAgent) {
    this.webhooks = webhooks;
    this.githubAgent = githubAgent;
    this.setupWebhookHandlers();
  }

  private setupWebhookHandlers(): void {
    // Handle issue opened events
    this.webhooks.on('issues.opened', async ({ payload }) => {
      console.log(`📝 New issue opened: #${payload.issue.number} in ${payload.repository.full_name}`);
      await this.handleIssueEvent(payload);
    });

    // Handle issue edited events
    this.webhooks.on('issues.edited', async ({ payload }) => {
      console.log(`✏️ Issue edited: #${payload.issue.number} in ${payload.repository.full_name}`);
      await this.handleIssueEvent(payload);
    });

    // Handle issue labeled events (in case we want to trigger on specific labels)
    this.webhooks.on('issues.labeled', async ({ payload }) => {
      const label = payload.label?.name;
      console.log(`🏷️ Issue labeled with "${label}": #${payload.issue.number} in ${payload.repository.full_name}`);
      
      // Only process if labeled with specific automation labels
      if (this.shouldProcessLabel(label)) {
        await this.handleIssueEvent(payload);
      }
    });

    // Handle issue comments (in case we want to trigger on specific commands)
    this.webhooks.on('issue_comment.created', async ({ payload }) => {
      const comment = payload.comment.body.toLowerCase().trim();
      console.log(`💬 New comment on issue #${payload.issue.number}: "${comment}"`);
      
      // Check for trigger commands
      if (this.shouldProcessComment(comment)) {
        await this.handleIssueEvent(payload);
      }
    });

    // Error handling
    this.webhooks.onError((error) => {
      console.error('❌ Webhook error:', error);
    });

    console.log('✅ Webhook handlers configured');
  }

  private async handleIssueEvent(payload: any): Promise<void> {
    try {
      // Extract issue data
      const issueData: IssueData = {
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        issueNumber: payload.issue.number,
        title: payload.issue.title,
        body: payload.issue.body || '',
        labels: payload.issue.labels.map((label: any) => label.name),
      };

      // Check if we should process this issue
      if (!this.shouldProcessIssue(issueData)) {
        console.log(`⏭️ Skipping issue #${issueData.issueNumber} - doesn't meet processing criteria`);
        return;
      }

      // Process the issue with the GitHub agent
      await this.githubAgent.handleIssue(issueData);
    } catch (error) {
      console.error('❌ Error handling issue event:', error);
    }
  }

  private shouldProcessIssue(issueData: IssueData): boolean {
    // Define criteria for when to process an issue
    
    // Skip if issue is already closed
    // (Note: This check would need to be added to the payload parsing)
    
    // Process if labeled with automation labels
    const automationLabels = ['auto-fix', 'bot-help', 'enhancement', 'bug'];
    const hasAutomationLabel = issueData.labels.some(label => 
      automationLabels.includes(label.toLowerCase())
    );

    // Process if title/body contains specific keywords
    const triggerKeywords = ['implement', 'add feature', 'create', 'build', 'fix'];
    const containsTriggerKeyword = triggerKeywords.some(keyword =>
      issueData.title.toLowerCase().includes(keyword) ||
      issueData.body.toLowerCase().includes(keyword)
    );

    // Process if issue is simple enough (basic heuristic)
    const isReasonableSize = issueData.body.length > 10 && issueData.body.length < 5000;

    return (hasAutomationLabel || containsTriggerKeyword) && isReasonableSize;
  }

  private shouldProcessLabel(label: string | undefined): boolean {
    if (!label) return false;
    
    const triggerLabels = ['auto-fix', 'bot-help', 'enhancement', 'bug', 'feature'];
    return triggerLabels.includes(label.toLowerCase());
  }

  private shouldProcessComment(comment: string): boolean {
    const triggerCommands = [
      'bot fix this',
      '/fix',
      '/implement',
      'auto-implement',
      'please implement this',
      'can you fix this'
    ];

    return triggerCommands.some(command => comment.includes(command));
  }
}
