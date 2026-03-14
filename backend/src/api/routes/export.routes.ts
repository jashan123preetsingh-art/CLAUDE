import { Router, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import { ExportService } from "../../services/export.service";

const router = Router();
const exportService = new ExportService();

router.get("/csv", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const csv = await exportService.exportCSV(req.userId!, {
      projectId: req.query.projectId as string,
      searchId: req.query.searchId as string,
      leadStatus: req.query.status as string,
      minScore: req.query.minScore ? parseInt(req.query.minScore as string) : undefined,
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=leads.csv");
    res.send(csv);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export failed";
    res.status(500).json({ error: message });
  }
});

router.get("/excel", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const buffer = await exportService.exportExcel(req.userId!, {
      projectId: req.query.projectId as string,
      searchId: req.query.searchId as string,
      leadStatus: req.query.status as string,
      minScore: req.query.minScore ? parseInt(req.query.minScore as string) : undefined,
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=leads.xlsx");
    res.send(buffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export failed";
    res.status(500).json({ error: message });
  }
});

export default router;
