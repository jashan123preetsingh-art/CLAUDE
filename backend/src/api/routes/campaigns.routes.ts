import { Router, Response } from "express";
import { z } from "zod";
import { authenticate, AuthRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { prisma } from "../../config/database";
import { EmailService } from "../../services/email.service";

const router = Router();
const emailService = new EmailService();

const createCampaignSchema = z.object({
  name: z.string().min(1),
  projectId: z.string().uuid(),
  emailAccountId: z.string().uuid().optional(),
  subject: z.string().min(1),
  bodyTemplate: z.string().min(1),
  channel: z.enum(["EMAIL", "INSTAGRAM_DM", "LINKEDIN", "CONTACT_FORM"]).default("EMAIL"),
  scheduledAt: z.string().datetime().optional(),
  followUpEnabled: z.boolean().default(false),
  followUpDays: z.number().min(1).max(30).default(3),
  followUpTemplate: z.string().optional(),
});

// Create campaign
router.post(
  "/",
  authenticate,
  validate(createCampaignSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const campaign = await prisma.outreachCampaign.create({
        data: {
          userId: req.userId!,
          ...req.body,
          scheduledAt: req.body.scheduledAt ? new Date(req.body.scheduledAt) : null,
        },
      });
      res.status(201).json(campaign);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create campaign";
      res.status(500).json({ error: message });
    }
  }
);

// Get all campaigns
router.get("/", authenticate, async (req: AuthRequest, res: Response) => {
  const campaigns = await prisma.outreachCampaign.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { emailsSent: true } } },
  });
  res.json(campaigns);
});

// Get campaign details
router.get("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  const campaign = await prisma.outreachCampaign.findFirst({
    where: { id: req.params.id, userId: req.userId! },
    include: {
      emailsSent: {
        include: { business: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  res.json(campaign);
});

// Start campaign
router.post(
  "/:id/start",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const campaign = await prisma.outreachCampaign.findFirst({
        where: { id: req.params.id, userId: req.userId! },
      });

      if (!campaign) {
        res.status(404).json({ error: "Campaign not found" });
        return;
      }

      if (campaign.status !== "DRAFT" && campaign.status !== "PAUSED") {
        res.status(400).json({ error: "Campaign cannot be started" });
        return;
      }

      // Process and queue emails
      await emailService.processCampaign(campaign.id);

      // Send queued emails
      const queuedEmails = await prisma.emailSent.findMany({
        where: { campaignId: campaign.id, status: "QUEUED" },
      });

      // Send emails with delay to avoid rate limits
      for (const email of queuedEmails) {
        emailService.sendTrackedEmail(email.id).catch((err) => {
          console.error(`Failed to send email ${email.id}:`, err);
        });
      }

      res.json({ message: "Campaign started", emailsQueued: queuedEmails.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start campaign";
      res.status(500).json({ error: message });
    }
  }
);

// Pause campaign
router.post(
  "/:id/pause",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    const campaign = await prisma.outreachCampaign.update({
      where: { id: req.params.id },
      data: { status: "PAUSED" },
    });
    res.json(campaign);
  }
);

// Get campaign analytics
router.get(
  "/:id/analytics",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    const campaign = await prisma.outreachCampaign.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });

    if (!campaign) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }

    const stats = await prisma.emailSent.groupBy({
      by: ["status"],
      where: { campaignId: campaign.id },
      _count: true,
    });

    res.json({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
      },
      stats: stats.reduce(
        (acc, s) => ({ ...acc, [s.status]: s._count }),
        {} as Record<string, number>
      ),
      totalRecipients: campaign.totalRecipients,
      sentCount: campaign.sentCount,
      openCount: campaign.openCount,
      replyCount: campaign.replyCount,
      openRate: campaign.sentCount
        ? ((campaign.openCount / campaign.sentCount) * 100).toFixed(1)
        : "0",
      replyRate: campaign.sentCount
        ? ((campaign.replyCount / campaign.sentCount) * 100).toFixed(1)
        : "0",
    });
  }
);

export default router;
