import { Router, Response } from "express";
import { z } from "zod";
import { authenticate, AuthRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AIService } from "../../services/ai.service";

const router = Router();
const aiService = new AIService();

const generateSchema = z.object({
  businessName: z.string().min(1),
  niche: z.string().min(1),
  location: z.string().min(1),
  websiteText: z.string().optional(),
  contactName: z.string().optional(),
  senderName: z.string().optional(),
  senderCompany: z.string().optional(),
});

// Generate outreach messages
router.post(
  "/generate",
  authenticate,
  validate(generateSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const messages = await aiService.generateOutreach(req.body);
      res.json(messages);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Generation failed";
      res.status(500).json({ error: message });
    }
  }
);

// Generate follow-up
router.post(
  "/follow-up",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { originalSubject, originalBody, businessName, daysSince } = req.body;
      const followUp = await aiService.generateFollowUp(
        originalSubject,
        originalBody,
        businessName,
        daysSince
      );
      res.json(followUp);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Generation failed";
      res.status(500).json({ error: message });
    }
  }
);

export default router;
