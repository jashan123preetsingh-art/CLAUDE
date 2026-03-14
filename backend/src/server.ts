import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { config } from "./config";

import authRoutes from "./api/routes/auth.routes";
import leadsRoutes from "./api/routes/leads.routes";
import projectsRoutes from "./api/routes/projects.routes";
import campaignsRoutes from "./api/routes/campaigns.routes";
import outreachRoutes from "./api/routes/outreach.routes";
import exportRoutes from "./api/routes/export.routes";
import dashboardRoutes from "./api/routes/dashboard.routes";

const app = express();

// Security & middleware
app.use(helmet());
app.use(
  cors({
    origin: config.frontendUrl,
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(morgan("combined"));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", limiter);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/leads", leadsRoutes);
app.use("/api/projects", projectsRoutes);
app.use("/api/campaigns", campaignsRoutes);
app.use("/api/outreach", outreachRoutes);
app.use("/api/export", exportRoutes);
app.use("/api/dashboard", dashboardRoutes);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Error handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
);

app.listen(config.port, () => {
  console.log(`LeadForge AI API running on port ${config.port}`);
});

export default app;
