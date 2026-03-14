import nodemailer from "nodemailer";
import sgMail from "@sendgrid/mail";
import { prisma } from "../config/database";
import { config } from "../config";

export class EmailService {
  private smtpTransport: nodemailer.Transporter | null = null;

  constructor() {
    if (config.sendgrid.apiKey) {
      sgMail.setApiKey(config.sendgrid.apiKey);
    }
  }

  private getSmtpTransport(): nodemailer.Transporter {
    if (!this.smtpTransport) {
      this.smtpTransport = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.port === 465,
        auth: {
          user: config.smtp.user,
          pass: config.smtp.pass,
        },
      });
    }
    return this.smtpTransport;
  }

  /**
   * Send a single email via SMTP.
   */
  async sendSMTP(to: string, subject: string, body: string, from?: string) {
    const transport = this.getSmtpTransport();
    return transport.sendMail({
      from: from || config.smtp.user,
      to,
      subject,
      html: body,
    });
  }

  /**
   * Send a single email via SendGrid.
   */
  async sendSendGrid(to: string, subject: string, body: string) {
    return sgMail.send({
      to,
      from: config.sendgrid.fromEmail,
      subject,
      html: body,
    });
  }

  /**
   * Send an email and track it in the database.
   */
  async sendTrackedEmail(emailSentId: string): Promise<void> {
    const emailRecord = await prisma.emailSent.findUnique({
      where: { id: emailSentId },
      include: { campaign: { include: { emailAccount: true } } },
    });

    if (!emailRecord) throw new Error("Email record not found");

    try {
      const account = emailRecord.campaign.emailAccount;
      if (account?.provider === "SENDGRID") {
        await this.sendSendGrid(
          emailRecord.toEmail,
          emailRecord.subject,
          emailRecord.body
        );
      } else {
        await this.sendSMTP(
          emailRecord.toEmail,
          emailRecord.subject,
          emailRecord.body,
          account?.email
        );
      }

      await prisma.emailSent.update({
        where: { id: emailSentId },
        data: { status: "SENT", sentAt: new Date() },
      });

      // Update campaign count
      await prisma.outreachCampaign.update({
        where: { id: emailRecord.campaignId },
        data: { sentCount: { increment: 1 } },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      await prisma.emailSent.update({
        where: { id: emailSentId },
        data: { status: "FAILED", errorMessage: message },
      });
      throw error;
    }
  }

  /**
   * Process a campaign: create email records and queue for sending.
   */
  async processCampaign(campaignId: string): Promise<void> {
    const campaign = await prisma.outreachCampaign.findUnique({
      where: { id: campaignId },
      include: { project: { include: { businesses: { include: { contacts: true } } } } },
    });

    if (!campaign?.project) throw new Error("Campaign or project not found");

    const businesses = campaign.project.businesses.filter((b) =>
      b.contacts.some((c) => c.email)
    );

    // Create email records for each business with an email
    for (const business of businesses) {
      const email = business.contacts.find((c) => c.email)?.email;
      if (!email) continue;

      const personalizedSubject = this.personalize(
        campaign.subject,
        business
      );
      const personalizedBody = this.personalize(
        campaign.bodyTemplate,
        business
      );

      await prisma.emailSent.create({
        data: {
          campaignId,
          businessId: business.id,
          toEmail: email,
          subject: personalizedSubject,
          body: personalizedBody,
          status: "QUEUED",
        },
      });
    }

    // Update campaign
    await prisma.outreachCampaign.update({
      where: { id: campaignId },
      data: {
        status: "RUNNING",
        totalRecipients: businesses.length,
      },
    });
  }

  /**
   * Replace personalization tags in templates.
   */
  private personalize(
    template: string,
    business: { name: string; city?: string | null; businessType?: string | null }
  ): string {
    return template
      .replace(/\{BusinessName\}/g, business.name)
      .replace(/\{business_name\}/g, business.name)
      .replace(/\{city\}/g, business.city || "")
      .replace(/\{City\}/g, business.city || "")
      .replace(/\{niche\}/g, business.businessType || "")
      .replace(/\{Niche\}/g, business.businessType || "");
  }
}
