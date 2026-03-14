import { Router, Response } from "express";
import { z } from "zod";
import { authenticate, AuthRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { prisma } from "../../config/database";

const router = Router();

const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

router.post(
  "/",
  authenticate,
  validate(createProjectSchema),
  async (req: AuthRequest, res: Response) => {
    const project = await prisma.project.create({
      data: { userId: req.userId!, ...req.body },
    });
    res.status(201).json(project);
  }
);

router.get("/", authenticate, async (req: AuthRequest, res: Response) => {
  const projects = await prisma.project.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { businesses: true, campaigns: true, searches: true } },
    },
  });
  res.json(projects);
});

router.get("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  const project = await prisma.project.findFirst({
    where: { id: req.params.id, userId: req.userId! },
    include: {
      businesses: {
        include: { contacts: true, socialProfiles: true },
        orderBy: { leadScore: "desc" },
      },
      campaigns: true,
      searches: true,
    },
  });

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.json(project);
});

router.put("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  const project = await prisma.project.updateMany({
    where: { id: req.params.id, userId: req.userId! },
    data: req.body,
  });
  res.json(project);
});

router.delete("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  await prisma.project.deleteMany({
    where: { id: req.params.id, userId: req.userId! },
  });
  res.status(204).send();
});

export default router;
