import crypto from "node:crypto";

export interface SentEmail {
  to: string;
  subject: string;
  rawToken: string;
  sentAt: Date;
}

class EmailService {
  private sentEmails: SentEmail[] = [];

  async sendVerificationEmail(to: string, rawToken: string): Promise<boolean> {
    const record: SentEmail = {
      to,
      subject: "Verify your CampusRideshare Institutional Email",
      rawToken,
      sentAt: new Date(),
    };
    this.sentEmails.push(record);

    if (process.env.NODE_ENV !== "test") {
      console.log(`📧 [EMAIL SERVICE] Sent verification email to ${to}: [TOKEN HASHED ON SERVER]`);
    }
    return true;
  }

  getRecentSentEmail(to: string): SentEmail | undefined {
    return this.sentEmails.filter((e) => e.to.toLowerCase() === to.toLowerCase()).pop();
  }

  clearEmails(): void {
    this.sentEmails = [];
  }
}

export const emailService = new EmailService();

export function generateVerificationToken(): { rawToken: string; tokenHash: string; expiresAt: Date } {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  // 30-minute validity window
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  return { rawToken, tokenHash, expiresAt };
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
