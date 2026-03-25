import type { Request, Response } from "express";
import type {
  ApiSuccess,
  GenerateWeeklySolutionDocResponseData,
  GetConfusionStatsResponseData,
  ListSolutionDocsResponseData,
} from "@nb-hub/contracts";
import { Router } from "express";
import { analyticsService } from "./analytics.service.js";

export const analyticsRouter = Router();

analyticsRouter.get(
  "/confusions",
  (_req: Request, res: Response<ApiSuccess<GetConfusionStatsResponseData>>) => {
    const data = analyticsService.getConfusionStats();
    res.status(200).json({ status: "ok", data });
  },
);

analyticsRouter.post(
  "/solution-docs/weekly",
  (_req: Request, res: Response<ApiSuccess<GenerateWeeklySolutionDocResponseData>>) => {
    const data = analyticsService.generateWeeklySolutionDoc();
    res.status(201).json({ status: "ok", data });
  },
);

analyticsRouter.get(
  "/solution-docs",
  (_req: Request, res: Response<ApiSuccess<ListSolutionDocsResponseData>>) => {
    const data = analyticsService.listSolutionDocs();
    res.status(200).json({ status: "ok", data });
  },
);
