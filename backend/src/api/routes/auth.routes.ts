import { Router, Request, Response } from "express";
import { z } from "zod";
import { AuthService } from "../../services/auth.service";
import { validate } from "../middleware/validate";
import { authenticate, AuthRequest } from "../middleware/auth";
import { prisma } from "../../config/database";

const router = Router();
const authService = new AuthService();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  company: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

router.post(
  "/register",
  validate(registerSchema),
  async (req: Request, res: Response) => {
    try {
      const result = await authService.register(req.body);
      res.status(201).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Registration failed";
      res.status(400).json({ error: message });
    }
  }
);

router.post(
  "/login",
  validate(loginSchema),
  async (req: Request, res: Response) => {
    try {
      const result = await authService.login(req.body.email, req.body.password);
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed";
      res.status(401).json({ error: message });
    }
  }
);

router.get("/me", authenticate, async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      company: true,
      plan: true,
      leadsUsed: true,
      leadsLimit: true,
      createdAt: true,
    },
  });
  res.json(user);
});

export default router;
