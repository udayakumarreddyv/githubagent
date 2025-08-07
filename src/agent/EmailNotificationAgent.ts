import nodemailer from 'nodemailer';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

export interface NotificationData {
  repositoryName: string;
  issueNumber: number;
  issueTitle: string;
  prNumber: number;
  prUrl: string;
  branchName: string;
  implementedFiles: string[];
  author: string;
}

export class EmailNotificationAgent {
  private transporter: nodemailer.Transporter | null = null;
  private isEnabled = false;
  private recipientGroups: Map<string, string[]> = new Map();

  constructor() {
    this.initializeEmailService();
    this.setupRecipientGroups();
  }

  /**
   * Initialize email service
   */
  private async initializeEmailService(): Promise<void> {
    try {
      if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.log('📧 Email service disabled - missing configuration');
        return;
      }

      const config: EmailConfig = {
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT || '587'),
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      };

      this.transporter = nodemailer.createTransport(config);
      
      // Verify connection
      await this.transporter.verify();
      this.isEnabled = true;
      console.log('✅ Email notification service initialized successfully');
      
    } catch (error) {
      console.log(`⚠️ Email service initialization failed: ${(error as Error).message}`);
      console.log('📧 Email notifications will be disabled');
    }
  }

  /**
   * Setup recipient groups based on environment configuration
   */
  private setupRecipientGroups(): void {
    // Default development team
    const devTeam = process.env.EMAIL_DEV_TEAM ? 
      process.env.EMAIL_DEV_TEAM.split(',').map(email => email.trim()) : 
      [];

    // Project managers and stakeholders
    const managers = process.env.EMAIL_MANAGERS ? 
      process.env.EMAIL_MANAGERS.split(',').map(email => email.trim()) : 
      [];

    // QA and testing team
    const qaTeam = process.env.EMAIL_QA_TEAM ? 
      process.env.EMAIL_QA_TEAM.split(',').map(email => email.trim()) : 
      [];

    this.recipientGroups.set('developers', devTeam);
    this.recipientGroups.set('managers', managers);
    this.recipientGroups.set('qa', qaTeam);
    this.recipientGroups.set('all', [...devTeam, ...managers, ...qaTeam]);

    console.log(`📧 Configured email groups: ${Array.from(this.recipientGroups.keys()).join(', ')}`);
  }

  /**
   * Send PR creation notification
   */
  async sendPRNotification(data: NotificationData, groups: string[] = ['developers']): Promise<boolean> {
    if (!this.isEnabled || !this.transporter) {
      console.log('📧 Email service not available - skipping notification');
      return false;
    }

    try {
      const recipients = this.getRecipients(groups);
      if (recipients.length === 0) {
        console.log('📧 No recipients configured for email notification');
        return false;
      }

      const emailContent = this.generatePRNotificationEmail(data);
      
      const mailOptions = {
        from: `"GitHub Agent" <${process.env.EMAIL_USER}>`,
        to: recipients.join(', '),
        subject: `🤖 PR Created: ${data.repositoryName} - Issue #${data.issueNumber}`,
        html: emailContent,
        text: this.generatePlainTextEmail(data)
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Email notification sent successfully to ${recipients.length} recipients`);
      console.log(`📧 Message ID: ${result.messageId}`);
      
      return true;
      
    } catch (error) {
      console.log(`❌ Failed to send email notification: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Get recipients for specified groups
   */
  private getRecipients(groups: string[]): string[] {
    const recipients = new Set<string>();
    
    for (const group of groups) {
      const groupEmails = this.recipientGroups.get(group) || [];
      groupEmails.forEach(email => recipients.add(email));
    }
    
    return Array.from(recipients).filter(email => email.length > 0);
  }

  /**
   * Generate HTML email content
   */
  private generatePRNotificationEmail(data: NotificationData): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #24292e; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; }
        .pr-info { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
        .files-list { background: #e8f5e8; padding: 10px; border-radius: 4px; margin: 10px 0; }
        .button { background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 10px 0; }
        .footer { color: #666; font-size: 12px; margin-top: 20px; padding-top: 15px; border-top: 1px solid #ddd; }
        .stats { display: flex; gap: 20px; margin: 15px 0; }
        .stat { background: white; padding: 10px; border-radius: 4px; text-align: center; flex: 1; }
        .emoji { font-size: 1.2em; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 GitHub Agent - Pull Request Created</h1>
            <p>Automated implementation completed successfully</p>
        </div>
        
        <div class="content">
            <div class="pr-info">
                <h2>📋 Pull Request Details</h2>
                <p><strong>Repository:</strong> ${data.repositoryName}</p>
                <p><strong>Issue:</strong> #${data.issueNumber} - ${data.issueTitle}</p>
                <p><strong>Pull Request:</strong> #${data.prNumber}</p>
                <p><strong>Branch:</strong> ${data.branchName}</p>
                <p><strong>Author:</strong> ${data.author}</p>
            </div>

            <div class="stats">
                <div class="stat">
                    <div class="emoji">📁</div>
                    <div><strong>${data.implementedFiles.length}</strong></div>
                    <div>Files Created</div>
                </div>
                <div class="stat">
                    <div class="emoji">🚀</div>
                    <div><strong>Ready</strong></div>
                    <div>For Review</div>
                </div>
                <div class="stat">
                    <div class="emoji">🤖</div>
                    <div><strong>AI</strong></div>
                    <div>Generated</div>
                </div>
            </div>

            <div class="files-list">
                <h3>📄 Implemented Files:</h3>
                <ul>
                    ${data.implementedFiles.map(file => `<li>${file}</li>`).join('')}
                </ul>
            </div>

            <div style="text-align: center; margin: 20px 0;">
                <a href="${data.prUrl}" class="button">🔍 Review Pull Request</a>
            </div>

            <div class="pr-info">
                <h3>✅ What to do next:</h3>
                <ol>
                    <li>Review the generated code for quality and correctness</li>
                    <li>Test the implementation in your local environment</li>
                    <li>Provide feedback or request changes if needed</li>
                    <li>Approve and merge when ready</li>
                </ol>
            </div>
        </div>

        <div class="footer">
            <p>🤖 This email was automatically generated by GitHub Agent</p>
            <p>Generated on ${new Date().toLocaleString()}</p>
            <p>If you believe this email was sent in error, please contact your system administrator.</p>
        </div>
    </div>
</body>
</html>
    `;
  }

  /**
   * Generate plain text email content
   */
  private generatePlainTextEmail(data: NotificationData): string {
    return `
GitHub Agent - Pull Request Created

Repository: ${data.repositoryName}
Issue: #${data.issueNumber} - ${data.issueTitle}
Pull Request: #${data.prNumber}
Branch: ${data.branchName}
Author: ${data.author}

Implemented Files:
${data.implementedFiles.map(file => `- ${file}`).join('\n')}

Review the pull request: ${data.prUrl}

What to do next:
1. Review the generated code for quality and correctness
2. Test the implementation in your local environment
3. Provide feedback or request changes if needed
4. Approve and merge when ready

---
This email was automatically generated by GitHub Agent
Generated on ${new Date().toLocaleString()}
    `;
  }

  /**
   * Test email configuration
   */
  async testConnection(): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.log(`❌ Email connection test failed: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Get service status
   */
  getStatus(): { enabled: boolean; groups: string[]; recipientCount: number } {
    const allRecipients = this.getRecipients(['all']);
    return {
      enabled: this.isEnabled,
      groups: Array.from(this.recipientGroups.keys()),
      recipientCount: allRecipients.length
    };
  }
}
