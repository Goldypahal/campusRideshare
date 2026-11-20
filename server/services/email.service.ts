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
    const appUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 5000}`;
    const verificationUrl = `${appUrl}/verify-email?token=${rawToken}`;
    const subject = "Verify your CampusRideshare Institutional Email";

    const record: SentEmail = {
      to,
      subject,
      rawToken,
      sentAt: new Date(),
    };
    this.sentEmails.push(record);

    let deliveredViaProvider = false;

    // 1. Resend API Provider
    if (process.env.RESEND_API_KEY) {
      try {
        const fromEmail = process.env.EMAIL_FROM || "CampusRideshare <onboarding@resend.dev>";
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [to],
            subject,
            html: `
              <h2>Welcome to CampusRideshare!</h2>
              <p>Please click the button below to verify your institutional campus email address:</p>
              <p style="margin: 24px 0;">
                <a href="${verificationUrl}" style="background-color: #2563eb; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                  Verify Campus Email
                </a>
              </p>
              <p>Or use your verification code: <code>${rawToken}</code></p>
              <p><small>This verification link expires in 30 minutes.</small></p>
            `,
          }),
        });

        if (res.ok) {
          deliveredViaProvider = true;
          console.log(`📧 [EMAIL SERVICE] Verification email successfully delivered via Resend to ${to}`);
        } else {
          const errData = await res.json().catch(() => ({}));
          console.warn("📧 [EMAIL SERVICE] Resend delivery failed, falling back to console:", errData);
        }
      } catch (err: any) {
        console.warn("📧 [EMAIL SERVICE] Resend delivery network error:", err.message);
      }
    }

    // 2. Clear Console Output (ensures verification link is readily accessible in dev/docker/logs)
    if (!deliveredViaProvider) {
      console.log(`
================================================================================
📧 [CAMPUS RIDESHARE EMAIL DISPATCH]
   To: ${to}
   Subject: ${subject}
   Verification URL: ${verificationUrl}
   Verification Token: ${rawToken}
   Expires in: 30 minutes
================================================================================`);
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
