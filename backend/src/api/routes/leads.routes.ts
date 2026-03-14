import { Router, Response } from "express";
import { z } from "zod";
import { authenticate, AuthRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { prisma } from "../../config/database";
import { ScraperService } from "../../services/scraper.service";

const router = Router();
const scraperService = new ScraperService();

// Search for businesses
const searchSchema = z.object({
  businessType: z.string().min(1),
  location: z.string().min(1),
  projectId: z.string().uuid().optional(),
});

router.post(
  "/search",
  authenticate,
  validate(searchSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      // Check lead limit
      if (req.user!.leadsUsed >= req.user!.leadsLimit) {
        res.status(403).json({ error: "Lead limit reached. Upgrade your plan." });
        return;
      }

      const { businessType, location, projectId } = req.body;

      // Create search record
      const search = await prisma.leadSearch.create({
        data: {
          userId: req.userId!,
          projectId,
          businessType,
          location,
        },
      });

      // Start scraping in background
      scraperService
        .searchGoogleMaps(businessType, location, search.id, projectId)
        .then(async (results) => {
          // Update user's lead count
          await prisma.user.update({
            where: { id: req.userId },
            data: { leadsUsed: { increment: results.length } },
          });
        })
        .catch((err) => console.error("Search failed:", err));

      res.status(202).json({
        message: "Search started",
        searchId: search.id,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Search failed";
      res.status(500).json({ error: message });
    }
  }
);

// Get search status
router.get(
  "/search/:searchId",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    const search = await prisma.leadSearch.findFirst({
      where: { id: req.params.searchId, userId: req.userId! },
      include: { businesses: { orderBy: { leadScore: "desc" } } },
    });

    if (!search) {
      res.status(404).json({ error: "Search not found" });
      return;
    }

    res.json(search);
  }
);

// Get all searches
router.get(
  "/searches",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    const searches = await prisma.leadSearch.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { businesses: true } } },
    });
    res.json(searches);
  }
);

// Get all businesses/leads with filtering
router.get(
  "/",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    const { projectId, status, minScore, page = "1", limit = "50" } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: Record<string, unknown> = {};
    if (projectId) where.projectId = projectId;
    if (status) where.leadStatus = status;
    if (minScore) where.leadScore = { gte: parseInt(minScore as string) };

    // Ensure user can only see their own leads
    where.OR = [
      { project: { userId: req.userId! } },
      { search: { userId: req.userId! } },
    ];

    const [businesses, total] = await Promise.all([
      prisma.business.findMany({
        where,
        include: { contacts: true, socialProfiles: true },
        orderBy: { leadScore: "desc" },
        skip,
        take: parseInt(limit as string),
      }),
      prisma.business.count({ where }),
    ]);

    res.json({
      data: businesses,
      total,
      page: parseInt(page as string),
      totalPages: Math.ceil(total / parseInt(limit as string)),
    });
  }
);

// Get single business
router.get(
  "/:id",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    const business = await prisma.business.findUnique({
      where: { id: req.params.id },
      include: { contacts: true, socialProfiles: true, emailsSent: true },
    });

    if (!business) {
      res.status(404).json({ error: "Business not found" });
      return;
    }

    res.json(business);
  }
);

// Update lead status
router.patch(
  "/:id/status",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    const { status } = req.body;
    const validStatuses = ["NEW", "CONTACTED", "REPLIED", "MEETING_BOOKED", "CLOSED"];

    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }

    const business = await prisma.business.update({
      where: { id: req.params.id },
      data: { leadStatus: status },
    });

    res.json(business);
  }
);

// Extract contacts from website
router.post(
  "/:id/extract-contacts",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const contacts = await scraperService.extractContacts(req.params.id);
      // Recalculate score
      await scraperService.recalculateLeadScore(req.params.id);
      res.json(contacts);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Extraction failed";
      res.status(500).json({ error: message });
    }
  }
);

// Add note to business
router.patch(
  "/:id/notes",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    const { notes } = req.body;
    const business = await prisma.business.update({
      where: { id: req.params.id },
      data: { notes },
    });
    res.json(business);
  }
);

export default router;
