import { Router, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import { prisma } from "../../config/database";

const router = Router();

router.get("/stats", authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;

  const [
    totalLeads,
    totalSearches,
    totalCampaigns,
    leadsByStatus,
    recentLeads,
    campaignStats,
  ] = await Promise.all([
    prisma.business.count({
      where: { OR: [{ project: { userId } }, { search: { userId } }] },
    }),
    prisma.leadSearch.count({ where: { userId } }),
    prisma.outreachCampaign.count({ where: { userId } }),
    prisma.business.groupBy({
      by: ["leadStatus"],
      where: { OR: [{ project: { userId } }, { search: { userId } }] },
      _count: true,
    }),
    prisma.business.findMany({
      where: { OR: [{ project: { userId } }, { search: { userId } }] },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        name: true,
        businessType: true,
        city: true,
        leadScore: true,
        leadStatus: true,
        createdAt: true,
      },
    }),
    prisma.outreachCampaign.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        status: true,
        sentCount: true,
        openCount: true,
        replyCount: true,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { leadsUsed: true, leadsLimit: true, plan: true },
  });

  res.json({
    totalLeads,
    totalSearches,
    totalCampaigns,
    leadsUsed: user?.leadsUsed || 0,
    leadsLimit: user?.leadsLimit || 0,
    plan: user?.plan,
    leadsByStatus: leadsByStatus.reduce(
      (acc, s) => ({ ...acc, [s.leadStatus]: s._count }),
      {} as Record<string, number>
    ),
    recentLeads,
    campaignStats,
  });
});

export default router;
