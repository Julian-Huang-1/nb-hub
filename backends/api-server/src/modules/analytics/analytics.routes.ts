import { Router } from "express";
import { analyticsService } from "./analytics.service.js";

export const analyticsRouter = Router();

analyticsRouter.get("/confusions", (_req, res) => {
  const data = analyticsService.getConfusionStats();
  res.status(200).json({ status: "ok", data });
});

analyticsRouter.post("/solution-docs/weekly", (_req, res) => {
  const data = analyticsService.generateWeeklySolutionDoc();
  res.status(201).json({ status: "ok", data });
});

analyticsRouter.get("/solution-docs", (_req, res) => {
  const data = analyticsService.listSolutionDocs();
  res.status(200).json({ status: "ok", data });
});
